"use client";

import { useState, useEffect } from "react";
import { X, FileText, Loader2 } from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size: string;
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

  useEffect(() => {
    if (!isOpen) return;

    async function fetchFiles() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/drive/list");
        if (!res.ok) {
          throw new Error("파일 목록을 불러오는 데 실패했습니다.");
        }
        const data = await res.json();
        setFiles(data.files || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchFiles();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-2xl rounded-xl shadow-2xl border border-outline-variant flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-outline-variant">
          <h2 className="text-headline-sm text-on-surface">구글 드라이브 파일 선택</h2>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors">
            <X size={24} />
          </button>
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

          {!loading && !error && files.length === 0 && (
            <div className="text-center py-12 text-on-surface-variant text-ui-body">
              구글 드라이브에 PDF 파일이 없습니다.
            </div>
          )}

          {!loading && !error && files.length > 0 && (
            <ul className="space-y-2">
              {files.map(file => (
                <li key={file.id}>
                  <button
                    onClick={() => onSelectFile(file.id, file.name)}
                    className="w-full text-left flex items-center gap-4 p-4 rounded-lg hover:bg-surface-variant border border-transparent hover:border-outline-variant transition-all"
                  >
                    <div className="p-2 bg-error-container/20 rounded-md text-error">
                      <FileText size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ui-label-bold text-on-surface truncate">{file.name}</p>
                      <p className="text-ui-label-sm text-on-surface-variant mt-1">
                        {new Date(file.modifiedTime).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
