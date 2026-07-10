import { useState, useEffect } from 'react';
import db from '@/lib/db';
import { useStore } from '@/store/useStore';

export function usePdfFile(fileId: string | null) {
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) return;

    let isMounted = true;

    async function fetchPdf() {
      setIsLoading(true);
      setError(null);
      
      try {
        // 1. 캐시 확인
        const cached = await db.pdfCache.get(fileId!);
        if (cached && cached.data) {
          console.log("로컬 캐시에서 PDF를 불러옵니다 (0.1초 렌더링).");
          if (isMounted) {
            setFileData(cached.data);
            setIsLoading(false);
          }
          return;
        }

        // 2. 캐시에 없으면 API에서 다운로드
        console.log("캐시에 PDF가 없어 Google Drive에서 다운로드합니다.");
        const res = await fetch(`/api/drive/download?fileId=${fileId}`);
        if (!res.ok) {
          throw new Error('PDF 다운로드에 실패했습니다. (Google 로그인 및 권한을 확인하세요)');
        }

        const arrayBuffer = await res.arrayBuffer();

        const { selectedFileName } = useStore.getState();
        // 3. Dexie.js에 영구 캐싱
        await db.pdfCache.put({
          fileId: fileId!,
          fileName: selectedFileName || '알 수 없는 파일',
          fileSize: arrayBuffer.byteLength,
          data: arrayBuffer,
          updatedAt: new Date().toISOString(),
        });

        if (isMounted) {
          setFileData(arrayBuffer);
        }
      } catch (err: unknown) {
        console.error(err);
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : "PDF를 불러오는 중 오류가 발생했습니다.";
          setError(errorMessage);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchPdf();

    return () => {
      isMounted = false;
    };
  }, [fileId]);

  return { fileData, isLoading, error };
}
