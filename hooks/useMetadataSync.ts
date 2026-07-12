import { useEffect } from "react";
import db, { PdfMetadata } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useStore } from "@/store/useStore";

export function useMetadataSync(fileId: string | null) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // 1. 로컬(Dexie)에서 메타데이터 실시간 불러오기
  const metadataList = useLiveQuery(
    async () => {
      if (!fileId) return [];
      const localData = await db.pdfMetadata.where("fileId").equals(fileId).toArray();
      // 최신순 정렬
      localData.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return localData;
    },
    [fileId],
    []
  );

  // 2. 초기 로드 시 백엔드(Supabase)와 양방향 동기화
  useEffect(() => {
    if (!fileId || !userId) return;

    async function syncWithServer() {
      try {
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
                updatedAt: serverItem.updated_at
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
              updatedAt: serverItem.updated_at
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
            updated_at: item.updatedAt
          }));
          const { error: upsertError } = await supabase.from("pdf_metadata").upsert(upsertData);
          if (upsertError) {
            console.error("Supabase 일괄 업로드 실패:", upsertError);
          }
        }

      } catch (err) {
        console.error("Supabase 동기화 실패 (오프라인 모드 유지):", err);
      }
    }

    syncWithServer();
  }, [fileId, userId]);

  // 3. 새로운 메타데이터 저장 (로컬 저장 후 백그라운드 동기화)
  const saveMetadata = async (
    page: number,
    type: "bookmark" | "memo",
    selectedText: string,
    content: string
  ) => {
    if (!fileId || !userId) {
      alert("로그인이 필요하거나 파일이 선택되지 않았습니다.");
      return;
    }

    const { selectedFileName } = useStore.getState();

    const newMeta: PdfMetadata = {
      id: crypto.randomUUID(), // 고유 ID
      fileId,
      fileName: selectedFileName || undefined,
      page,
      type,
      selectedText,
      content,
      updatedAt: new Date().toISOString(),
    };

    // 로컬 즉시 저장
    await db.pdfMetadata.put(newMeta);

    // 백그라운드 서버 동기화
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
      }
    } catch (err) {
      console.error("네트워크 오류 (로컬에는 저장됨):", err);
    }
  };
  
  // 4. 메타데이터 업데이트 (수정)
  const updateMetadata = async (id: string, newContent: string) => {
    if (!userId) return;
    
    // 로컬 즉시 업데이트
    const item = await db.pdfMetadata.get(id);
    if (item) {
      item.content = newContent;
      item.updatedAt = new Date().toISOString();
      await db.pdfMetadata.put(item);
    }

    // 백그라운드 서버 동기화
    try {
      await supabase.from("pdf_metadata")
        .update({ content: newContent, updated_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", userId);
    } catch (err) {
      console.error("Supabase 업데이트 동기화 실패:", err);
    }
  };

  // 5. 메타데이터 삭제
  const deleteMetadata = async (id: string) => {
    if (!userId) return;
    
    // 로컬 즉시 삭제
    await db.pdfMetadata.delete(id);

    // 백그라운드 서버 동기화
    try {
      await supabase.from("pdf_metadata").delete().eq("id", id).eq("user_id", userId);
    } catch (err) {
      console.error("Supabase 삭제 동기화 실패:", err);
    }
  };

  return { metadataList: metadataList || [], saveMetadata, updateMetadata, deleteMetadata };
}
