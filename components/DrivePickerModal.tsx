"use client";

import { useState, useEffect } from "react";
import { X, FileText, Loader2, Folder, ArrowLeft, Library, Settings2, Pin } from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
  mimeType: string;
}

interface DrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (fileId: string, fileName: string) => void;
}

export default function DrivePickerModal({ isOpen, onClose, onSelectFile }: DrivePickerModalProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [defaultFolderId, setDefaultFolderId] = useState<string | null>(null);
  
  // 경로 상태 (breadcrumb)
  const [path, setPath] = useState<{ id: string; name: string }[]>([{ id: "root", name: "내 드라이브" }]);
  const currentFolderId = path[path.length - 1]?.id || "root";

  // 모달 열릴 때 초기 상태 셋업
  useEffect(() => {
    if (isOpen) {
      const storedFolderId = localStorage.getItem("defaultFolderId");
      const storedPath = localStorage.getItem("pinnedFolderPath");
      if (storedFolderId && storedPath) {
        try {
          const parsedPath = JSON.parse(storedPath);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setDefaultFolderId(storedFolderId);
          setPath(parsedPath);
        } catch {
          setDefaultFolderId(null);
          setPath([{ id: "root", name: "내 드라이브" }]);
        }
      } else {
        setDefaultFolderId(null);
        setPath([{ id: "root", name: "내 드라이브" }]);
      }
    }
  }, [isOpen]);

  // 폴더 아이디가 바뀔 때마다 파일 목록 다시 불러오기
  useEffect(() => {
    if (!isOpen) return;

    async function fetchFiles() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/drive/list?folderId=${currentFolderId}`);
        if (!res.ok) {
          throw new Error("파일 목록을 불러오는 데 실패했습니다.");
        }
        const data = await res.json();
        setFiles(data.files || []);
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
        else setError("Unknown error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchFiles();
  }, [isOpen, currentFolderId]);

  const handleFolderClick = (folderId: string, folderName: string) => {
    setPath((prev) => [...prev, { id: folderId, name: folderName }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setPath((prev) => prev.slice(0, index + 1));
  };

  const isPinned = currentFolderId === defaultFolderId;

  const togglePin = () => {
    if (isPinned) {
      localStorage.removeItem("defaultFolderId");
      localStorage.removeItem("pinnedFolderPath");
      setDefaultFolderId(null);
    } else {
      localStorage.setItem("defaultFolderId", currentFolderId);
      localStorage.setItem("pinnedFolderPath", JSON.stringify(path));
      setDefaultFolderId(currentFolderId);
    }
  };

  const formatSize = (bytesStr?: string) => {
    if (!bytesStr) return "";
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return "";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (!isOpen) return null;

  // 서버 API에서 이미 폴더와 PDF만 필터링해서 보내줌
  const displayFiles = files;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-2xl rounded-xl shadow-2xl border border-outline-variant flex flex-col max-h-[85vh]">
        
        {/* Header (Breadcrumb & Action Buttons) */}
        <div className="flex justify-between items-start p-3 md:p-4 border-b border-outline-variant gap-2 md:gap-4">
          <h2 className="text-ui-label-bold md:text-ui-body text-on-surface flex items-center flex-wrap gap-x-1 gap-y-2 flex-1">
            {path.map((segment, index) => (
              <span key={segment.id} className="flex items-center">
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className={`hover:bg-surface-variant px-1.5 py-0.5 rounded transition-colors break-all text-left ${
                    index === path.length - 1 ? "text-primary font-bold" : "text-on-surface-variant"
                  }`}
                >
                  {segment.name}
                </button>
                {index < path.length - 1 && (
                  <span className="text-outline-variant mx-0.5 text-sm shrink-0">&gt;</span>
                )}
              </span>
            ))}
          </h2>
          
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {currentFolderId !== "root" && (
              <button
                onClick={togglePin}
                className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
                  isPinned 
                    ? "text-primary bg-primary/10 hover:bg-primary/20" 
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
                }`}
                title={isPinned ? "기본 폴더 해제" : "이 폴더를 기본으로 핀 고정"}
              >
                <Pin size={20} className={isPinned ? "fill-primary" : ""} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 md:p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-primary">
              <Loader2 size={40} className="animate-spin mb-4" />
              <p className="text-ui-label-bold text-on-surface-variant">파일 목록을 불러오는 중...</p>
            </div>
          )}
          
          {error && (
            <div className="p-4 bg-error-container/20 border border-error text-error rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && displayFiles.length === 0 && (
            <div className="text-center py-12 text-on-surface-variant text-ui-body">
              이 폴더에는 폴더나 PDF 파일이 없습니다.
            </div>
          )}

          {!loading && !error && displayFiles.length > 0 && (
            <ul className="">
              {displayFiles.map(file => {
                const isFolder = file.mimeType === "application/vnd.google-apps.folder";
                
                return (
                  <li key={file.id}>
                    <button
                      onClick={() => isFolder ? handleFolderClick(file.id, file.name) : onSelectFile(file.id, file.name)}
                      className="w-full text-left flex items-center gap-3 p-1 rounded-lg hover:bg-surface-variant border border-transparent hover:border-outline-variant transition-all"
                    >
                      <div className={`p-1.5 rounded-md ${isFolder ? 'bg-secondary-container/20 text-secondary' : 'bg-error-container/20 text-error'}`}>
                        {isFolder ? <Folder size={18} /> : <FileText size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-ui-label-bold text-on-surface truncate">{file.name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {isFolder ? "폴더" : `${formatSize(file.size)} • ${new Date(file.modifiedTime).toLocaleDateString()}`}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
