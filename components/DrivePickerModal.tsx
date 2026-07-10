"use client";

import { useState, useEffect } from "react";
import { X, FileText, Loader2, Folder, ArrowLeft, Library, Settings2 } from "lucide-react";

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

  const [viewMode, setViewMode] = useState<"library" | "explore">("explore");
  const [defaultFolderId, setDefaultFolderId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>("root");
  const [folderHistory, setFolderHistory] = useState<string[]>([]);

  // 모달 열릴 때 초기 상태 셋업
  useEffect(() => {
    if (isOpen) {
      const storedFolderId = localStorage.getItem("defaultFolderId");
      if (storedFolderId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDefaultFolderId(storedFolderId);
        setCurrentFolderId(storedFolderId);
        setViewMode("library");
        setFolderHistory([]);
      } else {
        setDefaultFolderId(null);
        setCurrentFolderId("root");
        setViewMode("explore");
        setFolderHistory([]);
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

  const handleFolderClick = (folderId: string) => {
    setFolderHistory((prev) => [...prev, currentFolderId]);
    setCurrentFolderId(folderId);
  };

  const handleBackClick = () => {
    if (folderHistory.length > 0) {
      const newHistory = [...folderHistory];
      const previousFolderId = newHistory.pop()!;
      setFolderHistory(newHistory);
      setCurrentFolderId(previousFolderId);
    }
  };

  const handleSetLibraryFolder = () => {
    localStorage.setItem("defaultFolderId", currentFolderId);
    setDefaultFolderId(currentFolderId);
    setViewMode("library");
    setFolderHistory([]);
  };

  const handleChangeLibraryFolder = () => {
    setViewMode("explore");
    setCurrentFolderId("root");
    setFolderHistory([]);
  };

  if (!isOpen) return null;

  const isLibraryMode = viewMode === "library";

  // 서재 모드일 때는 PDF 파일만 표시되도록 필터링 (안전을 위해)
  const displayFiles = isLibraryMode 
    ? files.filter(f => f.mimeType === "application/pdf") 
    : files;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-2xl rounded-xl shadow-2xl border border-outline-variant flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-outline-variant">
          <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
            {isLibraryMode ? (
              <>
                <Library className="text-primary" size={24} />
                내 서재
              </>
            ) : (
              "구글 드라이브 탐색"
            )}
          </h2>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-surface-container-lowest px-6 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            {!isLibraryMode && folderHistory.length > 0 && (
              <button 
                onClick={handleBackClick}
                className="flex items-center gap-1 text-ui-label-bold text-on-surface hover:text-primary transition-colors px-2 py-1 rounded hover:bg-surface-variant"
              >
                <ArrowLeft size={16} />
                뒤로 가기
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isLibraryMode && currentFolderId !== "root" && (
              <button
                onClick={handleSetLibraryFolder}
                className="flex items-center gap-1 text-ui-label-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded transition-colors border border-primary/20"
              >
                <Library size={16} />
                이 폴더를 서재로 지정
              </button>
            )}
            {isLibraryMode && (
              <button
                onClick={handleChangeLibraryFolder}
                className="flex items-center gap-1 text-ui-label-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant px-3 py-1.5 rounded transition-colors border border-outline-variant"
              >
                <Settings2 size={16} />
                서재 폴더 변경하기
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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
              {isLibraryMode 
                ? "서재 폴더에 PDF 파일이 없습니다." 
                : "이 폴더에는 폴더나 PDF 파일이 없습니다."}
            </div>
          )}

          {!loading && !error && displayFiles.length > 0 && (
            <ul className="space-y-2">
              {displayFiles.map(file => {
                const isFolder = file.mimeType === "application/vnd.google-apps.folder";
                
                return (
                  <li key={file.id}>
                    <button
                      onClick={() => isFolder ? handleFolderClick(file.id) : onSelectFile(file.id, file.name)}
                      className="w-full text-left flex items-center gap-4 p-4 rounded-lg hover:bg-surface-variant border border-transparent hover:border-outline-variant transition-all"
                    >
                      <div className={`p-2 rounded-md ${isFolder ? 'bg-secondary-container/20 text-secondary' : 'bg-error-container/20 text-error'}`}>
                        {isFolder ? <Folder size={24} /> : <FileText size={24} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-ui-label-bold text-on-surface truncate">{file.name}</p>
                        <p className="text-ui-label-sm text-on-surface-variant mt-1">
                          {isFolder ? "폴더" : new Date(file.modifiedTime).toLocaleDateString()}
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
