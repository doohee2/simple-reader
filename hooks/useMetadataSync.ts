import { useEffect, useState, useCallback, useRef } from "react";
import db, { PdfMetadata } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useStore } from "@/store/useStore";

export function useMetadataSync(fileId: string | null) {
  const { data: session } = useSession();
  // 동일한 구글 계정임에도 기기마다 id(sub)가 다르게 발급되는 현상을 방지하기 위해 이메일을 최우선 식별자로 사용합니다.
  const userId = session?.user?.email || session?.user?.id;

  // 1. 로컬(Dexie)에서 메타데이터 실시간 불러오기
  const metadataList = useLiveQuery(
    async () => {
      if (!fileId) return [];
      const localData = await db.pdfMetadata.where("fileId").equals(fileId).toArray();
      // Soft Delete(삭제됨) 항목 필터링 및 최신순 정렬
      const activeData = localData.filter(item => !item.deletedAt);
      activeData.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return activeData;
    },
    [fileId],
  );

  const trashList = useLiveQuery(
    async () => {
      if (!fileId) return [];
      const localData = await db.pdfMetadata.where("fileId").equals(fileId).toArray();
      const deletedData = localData.filter(item => !!item.deletedAt);
      deletedData.sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
      return deletedData;
    },
    [fileId],
    []
  );

  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  const manualSync = useCallback(async () => {
    if (!fileId || !userId || isSyncingRef.current || fileId.startsWith('local-')) return;
    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
        // 0. 30일 초과된 Soft Delete 항목 영구 삭제 (서버 및 로컬)
        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const thresholdISO = thirtyDaysAgo.toISOString();

          // 로컬 Dexie 정리 (현재 파일 기준)
          const oldLocalItems = await db.pdfMetadata
            .where("fileId").equals(fileId as string)
            .filter(item => !!item.deletedAt && item.deletedAt < thresholdISO)
            .primaryKeys();
          
          if (oldLocalItems.length > 0) {
            await db.pdfMetadata.bulkDelete(oldLocalItems);
          }

          // 서버 Supabase 정리 (현재 접속한 유저의 모든 오래된 삭제 기록 정리)
          await supabase.from("pdf_metadata")
            .delete()
            .eq("user_id", userId as string)
            .not("deleted_at", "is", null)
            .lt("deleted_at", thresholdISO);
        } catch (cleanupErr) {
          console.error("오래된 삭제 데이터 영구 삭제 실패:", cleanupErr);
        }

        // 1. 서버 데이터와 로컬 데이터 각각 가져오기
        const [ { data: serverData, error }, localData ] = await Promise.all([
          supabase.from("pdf_metadata").select("*").eq("file_id", fileId as string).eq("user_id", userId as string),
          db.pdfMetadata.where("fileId").equals(fileId as string).toArray()
        ]);

        if (error) throw error;

        const serverItems = serverData || [];
        const localItems = localData || [];

        // 2. Map으로 변환하여 비교 용이하게 처리
        const serverMap = new Map(serverItems.map(item => [item.id, item]));
        const localMap = new Map(localItems.map(item => [item.id, item]));

        const localNeedsUpload: PdfMetadata[] = [];
        const serverNeedsDownload: PdfMetadata[] = [];

        // 3. 로컬 데이터 순회: 서버에 없거나 로컬이 더 최신인 경우
        localItems.forEach(localItem => {
          const serverItem = serverMap.get(localItem.id);
          if (!serverItem) {
            // 서버에 없음 (오프라인에서 생성됨) -> 업로드 필요
            localNeedsUpload.push(localItem);
          } else {
            // 양쪽에 있음 -> 시간 비교
            const localTime = new Date(localItem.updatedAt).getTime();
            const serverTime = new Date(serverItem.updated_at).getTime();
            if (localTime > serverTime) {
              localNeedsUpload.push(localItem); // 로컬이 더 최신
            } else if (serverTime > localTime) {
              // 서버가 더 최신이므로 로컬 덮어쓰기 예약 (DB 형식에 맞춤)
              serverNeedsDownload.push({
                id: serverItem.id,
                fileId: serverItem.file_id,
                page: serverItem.page,
                type: serverItem.type,
                selectedText: serverItem.selected_text,
                content: serverItem.content,
                updatedAt: serverItem.updated_at,
                deletedAt: serverItem.deleted_at || undefined,
                isUnsynced: false
              });
            }
          }
        });

        // 4. 서버 데이터 순회: 로컬에 없는 경우
        serverItems.forEach(serverItem => {
          if (!localMap.has(serverItem.id)) {
            // 로컬에 없음 -> 다운로드(로컬 저장) 필요
            serverNeedsDownload.push({
              id: serverItem.id,
              fileId: serverItem.file_id,
              page: serverItem.page,
              type: serverItem.type,
              selectedText: serverItem.selected_text,
              content: serverItem.content,
              updatedAt: serverItem.updated_at,
              deletedAt: serverItem.deleted_at || undefined,
              isUnsynced: false
            });
          }
        });

        // 5. 일괄 처리 (Batch Operations)
        if (serverNeedsDownload.length > 0) {
          await db.pdfMetadata.bulkPut(serverNeedsDownload);
        }

        if (localNeedsUpload.length > 0) {
          const upsertData = localNeedsUpload.map(item => ({
            id: item.id,
            user_id: userId,
            file_id: item.fileId,
            page: item.page,
            type: item.type,
            selected_text: item.selectedText,
            content: item.content,
            updated_at: item.updatedAt,
            deleted_at: item.deletedAt || null
          }));
          const { error: upsertError } = await supabase.from("pdf_metadata").upsert(upsertData);
          if (upsertError) {
            console.error("Supabase 일괄 업로드 실패:", upsertError);
          } else {
            // 업로드 성공 시 로컬의 isUnsynced 플래그 제거
            const updatedLocals = localNeedsUpload.map(item => ({ ...item, isUnsynced: false }));
            await db.pdfMetadata.bulkPut(updatedLocals);
          }
        }

      } catch (err) {
        console.error("Supabase 동기화 실패 (오프라인 모드 유지):", err);
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
  }, [fileId, userId]);

  // 2. 백엔드(Supabase) 동기화 스케줄링
  useEffect(() => {
    // 1. 초기 1회 실행
    manualSync();

    // 2. 10분(600,000ms) 주기 정기 폴링
    const intervalId = setInterval(manualSync, 600000);

    return () => {
      clearInterval(intervalId);
    };
  }, [manualSync]);

  // 3. 새로운 메타데이터 저장 (로컬 저장 후 백그라운드 동기화)
  const saveMetadata = async (
    page: number,
    type: "bookmark" | "memo",
    selectedText: string,
    content: string
  ) => {
    if (!fileId) {
      alert("파일이 선택되지 않았습니다.");
      return;
    }

    const { selectedFileName } = useStore.getState();

    const isLocalFile = fileId.startsWith('local-');

    const newMeta: PdfMetadata = {
      id: crypto.randomUUID(), // 고유 ID
      fileId,
      fileName: selectedFileName || undefined,
      page,
      type,
      selectedText,
      content,
      updatedAt: new Date().toISOString(),
      isUnsynced: isLocalFile ? false : !userId, // 로컬 파일은 동기화 대상이 아니므로 플래그 제외
    };

    // 로컬 즉시 저장
    await db.pdfMetadata.put(newMeta);

    // 로그인 상태이면서 드라이브 파일일 때만 서버 동기화 시도
    if (userId && !isLocalFile) {
      try {
        const { error } = await supabase.from("pdf_metadata").upsert({
          id: newMeta.id,
          user_id: userId,
          file_id: newMeta.fileId,
          page: newMeta.page,
          type: newMeta.type,
          selected_text: newMeta.selectedText,
          content: newMeta.content,
          updated_at: newMeta.updatedAt,
        });

        if (error) {
          console.error("Supabase 백업 실패 (로컬에는 저장됨):", error);
        } else {
          newMeta.isUnsynced = false;
          await db.pdfMetadata.put(newMeta);
        }
      } catch (err) {
        console.error("네트워크 오류 (로컬에는 저장됨):", err);
      }
    }
  };
  
  // 4. 메타데이터 업데이트 (수정)
  const updateMetadata = async (id: string, newContent: string) => {
    const isLocalFile = fileId?.startsWith('local-');

    // 로컬 즉시 업데이트
    const item = await db.pdfMetadata.get(id);
    if (item) {
      item.content = newContent;
      item.updatedAt = new Date().toISOString();
      item.isUnsynced = isLocalFile ? false : !userId;
      await db.pdfMetadata.put(item);
    }

    if (userId && !isLocalFile) {
      // 백그라운드 서버 동기화
      try {
        const { error } = await supabase.from("pdf_metadata")
          .update({ content: newContent, updated_at: new Date().toISOString() })
          .eq("id", id).eq("user_id", userId);
          
        if (!error && item) {
          item.isUnsynced = false;
          await db.pdfMetadata.put(item);
        }
      } catch (err) {
        console.error("Supabase 업데이트 동기화 실패:", err);
      }
    }
  };

  // 5. 메타데이터 삭제 (Soft Delete)
  const deleteMetadata = async (id: string) => {
    const isLocalFile = fileId?.startsWith('local-');
    const now = new Date().toISOString();

    // 로컬 Soft Delete 처리 (실제 삭제 대신 deletedAt 기록)
    const item = await db.pdfMetadata.get(id);
    if (item) {
      item.deletedAt = now;
      item.updatedAt = now;
      item.isUnsynced = isLocalFile ? false : !userId;
      await db.pdfMetadata.put(item);
    }

    if (userId && !isLocalFile) {
      // 백그라운드 서버 동기화 (업데이트)
      try {
        const { error } = await supabase.from("pdf_metadata")
          .update({ deleted_at: now, updated_at: now })
          .eq("id", id).eq("user_id", userId);
          
        if (!error && item) {
          item.isUnsynced = false;
          await db.pdfMetadata.put(item);
        }
      } catch (err) {
        console.error("Supabase 삭제 동기화 실패:", err);
      }
    }
  };

  // 6. 메타데이터 복구 (Restore)
  const restoreMetadata = async (id: string) => {
    const isLocalFile = fileId?.startsWith('local-');
    const now = new Date().toISOString();

    const item = await db.pdfMetadata.get(id);
    if (item) {
      delete item.deletedAt;
      item.updatedAt = now;
      item.isUnsynced = isLocalFile ? false : !userId;
      await db.pdfMetadata.put(item);
    }

    if (userId && !isLocalFile) {
      try {
        const { error } = await supabase.from("pdf_metadata")
          .update({ deleted_at: null, updated_at: now })
          .eq("id", id).eq("user_id", userId);
          
        if (!error && item) {
          item.isUnsynced = false;
          await db.pdfMetadata.put(item);
        }
      } catch (err) {
        console.error("Supabase 복구 동기화 실패:", err);
      }
    }
  };

  return { metadataList: metadataList || [], trashList: trashList || [], saveMetadata, updateMetadata, deleteMetadata, restoreMetadata, manualSync, isSyncing };
}
