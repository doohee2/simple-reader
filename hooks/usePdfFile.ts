import { useState, useEffect, useRef } from 'react';
import db from '@/lib/db';
import { useStore } from '@/store/useStore';
import { useSession } from 'next-auth/react';
import { fetchWithSessionRetry } from '@/lib/fetchWithSessionRetry';

export type DownloadState = 'idle' | 'confirm' | 'downloading' | 'proxy_confirm' | 'error' | 'success';

export function usePdfFile(fileId: string | null) {
  const { data: session } = useSession();
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState(0);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    if (!fileId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFileData(null);
      setDownloadState('idle');
      setTotalBytes(0);
      return;
    }

    // Initialize totalBytes from store for the confirm modal
    const storeSize = useStore.getState().selectedFileSize;
    if (storeSize) {
      setTotalBytes(storeSize);
    }

    async function checkCache() {
      setDownloadState('idle');
      setFileData(null); // Clear previous data when new file is selected
      try {
        const cached = await db.pdfCache.get(fileId!);
        if (cached && cached.data) {
          console.log("로컬 캐시에서 PDF를 불러옵니다.");
          if (isMountedRef.current) {
            setFileData(cached.data);
            setDownloadState('success');
          }
          return;
        }
        
        if (fileId?.startsWith('local-')) {
          if (isMountedRef.current) {
            setError("로컬 기기 저장소에서 해당 파일을 찾을 수 없습니다. (캐시가 삭제되었을 수 있습니다.) 다시 업로드해주세요.");
            setDownloadState('error');
          }
          return;
        }

        if (isMountedRef.current) {
          setDownloadState('confirm');
        }
      } catch (err) {
        console.error(err);
      }
    }

    checkCache();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fileId]);

  const processStream = async (response: Response) => {
    const contentLength = response.headers.get('content-length');
    const storeSize = useStore.getState().selectedFileSize;
    const total = contentLength ? parseInt(contentLength, 10) : (storeSize || 0);
    
    if (isMountedRef.current) setTotalBytes(total);
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error("ReadableStream not supported");

    let loaded = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!isMountedRef.current) return null;
      
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        setLoadedBytes(loaded);
        if (total > 0) {
          setProgress(Math.round((loaded / total) * 100));
        }
      }
    }

    const arrayBuffer = new Uint8Array(loaded);
    let position = 0;
    for (const chunk of chunks) {
      arrayBuffer.set(chunk, position);
      position += chunk.byteLength;
    }
    
    return arrayBuffer.buffer;
  };

  const saveToCacheAndSet = async (arrayBuffer: ArrayBuffer) => {
    const { selectedFileName, selectedFileSize } = useStore.getState();
    await db.pdfCache.put({
      fileId: fileId!,
      fileName: selectedFileName || '알 수 없는 파일',
      fileSize: selectedFileSize || arrayBuffer.byteLength,
      data: arrayBuffer,
      updatedAt: new Date().toISOString(),
    });
    if (isMountedRef.current) {
      setFileData(arrayBuffer);
      setDownloadState('success');
    }
  };

  const startDirectDownload = async () => {
    if (!fileId || !session?.accessToken) {
      setError("로그인 세션이 만료되었거나 권한이 없습니다.");
      setDownloadState('proxy_confirm'); // 프록시로 폴백 유도
      return;
    }

    setDownloadState('downloading');
    setProgress(0);
    setLoadedBytes(0);
    setError(null);
    
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetchWithSessionRetry(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        signal: abortControllerRef.current.signal,
      }, (newSession) => ({
        headers: {
          Authorization: `Bearer ${newSession.accessToken}`,
        },
        signal: abortControllerRef.current.signal,
      }));

      if (!res.ok) {
        throw new Error(`Direct download failed with status ${res.status}`);
      }

      const arrayBuffer = await processStream(res);
      if (arrayBuffer) {
        await saveToCacheAndSet(arrayBuffer);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error("Direct download error:", err);
      if (isMountedRef.current) {
        setError("직접 다운로드에 실패했습니다. (CORS, 만료된 토큰 또는 권한 문제일 수 있습니다)");
        setDownloadState('proxy_confirm');
      }
    }
  };

  const startProxyDownload = async () => {
    if (!fileId) return;

    setDownloadState('downloading');
    setProgress(0);
    setLoadedBytes(0);
    setError(null);
    
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetchWithSessionRetry(`/api/drive/download?fileId=${fileId}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        throw new Error('PDF 프록시 다운로드에 실패했습니다.');
      }

      const arrayBuffer = await processStream(res);
      if (arrayBuffer) {
        await saveToCacheAndSet(arrayBuffer);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error("Proxy download error:", err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "다운로드 중 오류가 발생했습니다.");
        setDownloadState('error');
      }
    }
  };

  const cancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    useStore.getState().setSelectedFile(null, null, null);
    setDownloadState('idle');
  };

  return { 
    fileData, 
    isLoading: downloadState === 'downloading',
    downloadState, 
    progress, 
    loadedBytes, 
    totalBytes, 
    error, 
    startDirectDownload, 
    startProxyDownload, 
    cancelDownload 
  };
}
