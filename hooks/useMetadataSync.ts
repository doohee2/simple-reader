import { useState, useEffect, useCallback } from "react";
import db, { PdfMetadata } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";

export function useMetadataSync(fileId: string | null) {
  const { data: session } = useSession();
  const [metadataList, setMetadataList] = useState<PdfMetadata[]>([]);
  // @ts-ignore
  const userId = session?.user?.id;

  // 1. 로컬(Dexie)에서 메타데이터 불러오기
  const loadLocalMetadata = useCallback(async () => {
    if (!fileId) return;
    try {
      const localData = await db.pdfMetadata.where("fileId").equals(fileId).toArray();
      // 최신순 정렬
      localData.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setMetadataList(localData);
    } catch (err) {
      console.error("로컬 메타데이터 로드 실패:", err);
    }
  }, [fileId]);

  // 2. 초기 로드 시 로컬 데이터 즉시 세팅 후, 백엔드(Supabase)와 동기화
  useEffect(() => {
    if (!fileId || !userId) return;

    let isMounted = true;

    async function syncWithServer() {
      await loadLocalMetadata();

      try {
        // 백엔드에서 최신 데이터 가져오기
        const { data: serverData, error } = await supabase
          .from("pdf_metadata")
          .select("*")
          .eq("file_id", fileId)
          .eq("user_id", userId);

        if (error) throw error;

        if (serverData && serverData.length > 0) {
          // 백엔드 데이터를 Dexie 형식으로 변환하여 로컬에 병합 (간이 충돌 해결 로직: 서버 덮어쓰기)
          const mergedData = serverData.map(item => ({
            id: item.id,
            fileId: item.file_id,
            page: item.page,
            type: item.type,
            selectedText: item.selected_text,
            content: item.content,
            updatedAt: item.updated_at
          }));

          await db.pdfMetadata.bulkPut(mergedData);
          if (isMounted) {
            await loadLocalMetadata();
          }
        }
      } catch (err) {
        console.error("Supabase 동기화 실패 (오프라인 모드 유지):", err);
      }
    }

    syncWithServer();

    return () => {
      isMounted = false;
    };
  }, [fileId, userId, loadLocalMetadata]);

  // 3. 새로운 메타데이터 저장 (로컬 저장 후 즉시 UI 업데이트, 이후 백그라운드 동기화)
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

    const newMeta: PdfMetadata = {
      id: crypto.randomUUID(), // 고유 ID
      fileId,
      page,
      type,
      selectedText,
      content,
      updatedAt: new Date().toISOString(),
    };

    // 로컬 즉시 저장
    await db.pdfMetadata.put(newMeta);
    await loadLocalMetadata();

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
  
  // 4. 메타데이터 삭제
  const deleteMetadata = async (id: string) => {
    if (!userId) return;
    
    // 로컬 즉시 삭제
    await db.pdfMetadata.delete(id);
    await loadLocalMetadata();

    // 백그라운드 서버 동기화
    try {
      await supabase.from("pdf_metadata").delete().eq("id", id).eq("user_id", userId);
    } catch (err) {
      console.error("Supabase 삭제 동기화 실패:", err);
    }
  };

  return { metadataList, saveMetadata, deleteMetadata };
}
