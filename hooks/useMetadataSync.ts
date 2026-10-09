import { useEffect, useState, useCallback, useRef } from "react";
import db, { PdfMetadata } from "@/lib/db";
import { useSession } from "next-auth/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useStore } from "@/store/useStore";
import { fetchWithSessionRetry } from "@/lib/fetchWithSessionRetry";

export function useMetadataSync(fileId: string | null) {
  const { data: session } = useSession();
  const userId = session?.user?.email || session?.user?.id;

  const metadataList = useLiveQuery(
    async () => {
      if (!fileId) return [];
      const localData = await db.pdfMetadata.where("fileId").equals(fileId).toArray();
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
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thresholdISO = thirtyDaysAgo.toISOString();

        // 로컬 Dexie 정리
        const oldLocalItems = await db.pdfMetadata
          .where("fileId").equals(fileId as string)
          .filter(item => !!item.deletedAt && item.deletedAt < thresholdISO)
          .primaryKeys();
        
        if (oldLocalItems.length > 0) {
          await db.pdfMetadata.bulkDelete(oldLocalItems);
        }

        // 1. 서버 데이터와 로컬 데이터 각각 가져오기
        const [ serverResponse, localData ] = await Promise.all([
          fetchWithSessionRetry(`/api/metadata/sync?fileId=${fileId}`),
          db.pdfMetadata.where("fileId").equals(fileId as string).toArray()
        ]);

        if (!serverResponse.ok) throw new Error("Failed to fetch server data");
        const { data: serverItems = [] } = await serverResponse.json();
        const localItems = localData || [];

        const serverMap = new Map(serverItems.map((item: any) => [item.id, item]));
        const localMap = new Map(localItems.map((item: any) => [item.id, item]));

        const localNeedsUpload: PdfMetadata[] = [];
        const serverNeedsDownload: PdfMetadata[] = [];

        localItems.forEach(localItem => {
          const serverItem = serverMap.get(localItem.id) as any;
          if (!serverItem) {
            localNeedsUpload.push(localItem);
          } else {
            const localTime = new Date(localItem.updatedAt).getTime();
            const serverTime = new Date(serverItem.updated_at).getTime();
            if (localTime > serverTime) {
              localNeedsUpload.push(localItem);
            } else if (serverTime > localTime) {
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

        serverItems.forEach((serverItem: any) => {
          if (!localMap.has(serverItem.id)) {
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

        if (serverNeedsDownload.length > 0) {
          await db.pdfMetadata.bulkPut(serverNeedsDownload);
        }

        if (localNeedsUpload.length > 0) {
          const upsertData = localNeedsUpload.map(item => ({
            id: item.id,
            file_id: item.fileId,
            page: item.page,
            type: item.type,
            selected_text: item.selectedText,
            content: item.content,
            updated_at: item.updatedAt,
            deleted_at: item.deletedAt || null
          }));

          const res = await fetchWithSessionRetry("/api/metadata/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ upsertItems: upsertData, deleteOldBefore: thresholdISO })
          });

          if (!res.ok) {
            console.error("서버 일괄 업로드 실패");
          } else {
            const updatedLocals = localNeedsUpload.map(item => ({ ...item, isUnsynced: false }));
            await db.pdfMetadata.bulkPut(updatedLocals);
          }
        } else {
          // 업로드할 건 없지만 오래된 삭제본 서버 정리 요청
          await fetchWithSessionRetry("/api/metadata/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deleteOldBefore: thresholdISO })
          });
        }

      } catch (err) {
        console.error("동기화 실패 (오프라인 모드 등):", err);
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
  }, [fileId, userId]);

  useEffect(() => {
    manualSync();
    const intervalId = setInterval(manualSync, 600000);
    return () => clearInterval(intervalId);
  }, [manualSync]);

  const pushSingleItemToServer = async (item: PdfMetadata) => {
    const res = await fetchWithSessionRetry("/api/metadata/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upsertItems: [{
          id: item.id,
          file_id: item.fileId,
          page: item.page,
          type: item.type,
          selected_text: item.selectedText,
          content: item.content,
          updated_at: item.updatedAt,
          deleted_at: item.deletedAt || null
        }]
      })
    });
    
    if (res.ok) {
      item.isUnsynced = false;
      await db.pdfMetadata.put(item);
    } else {
      throw new Error("서버 동기화 실패");
    }
  };

  const saveMetadata = async (
    page: number,
    type: "bookmark" | "memo",
    selectedText: string,
    content: string
  ) => {
    if (!fileId) return;

    const { selectedFileName } = useStore.getState();
    const isLocalFile = fileId.startsWith('local-');

    const newMeta: PdfMetadata = {
      id: crypto.randomUUID(),
      fileId,
      fileName: selectedFileName || undefined,
      page,
      type,
      selectedText,
      content,
      updatedAt: new Date().toISOString(),
      isUnsynced: isLocalFile ? false : !userId,
    };

    await db.pdfMetadata.put(newMeta);

    if (userId && !isLocalFile) {
      try {
        await pushSingleItemToServer(newMeta);
      } catch (err) {
        console.error("네트워크 오류 (로컬에는 저장됨):", err);
      }
    }
  };
  
  const updateMetadata = async (id: string, newContent: string) => {
    const isLocalFile = fileId?.startsWith('local-');
    const item = await db.pdfMetadata.get(id);
    if (item) {
      item.content = newContent;
      item.updatedAt = new Date().toISOString();
      item.isUnsynced = isLocalFile ? false : !userId;
      await db.pdfMetadata.put(item);

      if (userId && !isLocalFile) {
        try {
          await pushSingleItemToServer(item);
        } catch (err) {
          console.error("업데이트 동기화 실패:", err);
        }
      }
    }
  };

  const deleteMetadata = async (id: string) => {
    const isLocalFile = fileId?.startsWith('local-');
    const now = new Date().toISOString();

    const item = await db.pdfMetadata.get(id);
    if (item) {
      item.deletedAt = now;
      item.updatedAt = now;
      item.isUnsynced = isLocalFile ? false : !userId;
      await db.pdfMetadata.put(item);

      if (userId && !isLocalFile) {
        try {
          await pushSingleItemToServer(item);
        } catch (err) {
          console.error("삭제 동기화 실패:", err);
        }
      }
    }
  };

  const restoreMetadata = async (id: string) => {
    const isLocalFile = fileId?.startsWith('local-');
    const now = new Date().toISOString();

    const item = await db.pdfMetadata.get(id);
    if (item) {
      delete item.deletedAt;
      item.updatedAt = now;
      item.isUnsynced = isLocalFile ? false : !userId;
      await db.pdfMetadata.put(item);

      if (userId && !isLocalFile) {
        try {
          await pushSingleItemToServer(item);
        } catch (err) {
          console.error("복구 동기화 실패:", err);
        }
      }
    }
  };

  return { metadataList: metadataList || [], trashList: trashList || [], saveMetadata, updateMetadata, deleteMetadata, restoreMetadata, manualSync, isSyncing };
}
