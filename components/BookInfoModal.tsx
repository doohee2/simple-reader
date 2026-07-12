"use client";

import { useEffect, useState } from "react";
import { X, FileText, CheckCircle2 } from "lucide-react";
import db from "@/lib/db";

interface BookInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string | null;
  fileName: string | null;
  fileSize: number | null;
}

export default function BookInfoModal({ isOpen, onClose, fileId, fileName, fileSize }: BookInfoModalProps) {
  const [memoCount, setMemoCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);

  useEffect(() => {
    if (isOpen && fileId) {
      db.pdfMetadata.where("fileId").equals(fileId).toArray().then(metadata => {
        setMemoCount(metadata.filter(m => m.type === "memo" && !m.deletedAt).length);
        setBookmarkCount(metadata.filter(m => m.type === "bookmark" && !m.deletedAt).length);
      }).catch(err => console.error("Failed to fetch metadata counts", err));
    }
  }, [isOpen, fileId]);

  if (!isOpen || !fileId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-xl shadow-xl max-w-sm w-full p-6 relative border border-outline-variant">
        <button onClick={onClose} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface">
          <X size={20} />
        </button>
        <div className="flex items-center gap-2 mb-4 text-primary">
          <FileText className="text-primary" size={24} />
          <h3 className="text-title-md font-bold text-on-surface">도서 정보</h3>
        </div>
        
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-ui-label-sm text-on-surface-variant mb-1">제목</p>
            <p className="text-ui-body text-on-surface font-bold break-words">{fileName || '알 수 없는 파일'}</p>
          </div>
          
          <div className="flex gap-6">
            <div>
              <p className="text-ui-label-sm text-on-surface-variant mb-1">파일 크기</p>
              <p className="text-ui-body text-on-surface">
                {fileSize ? `${(fileSize / 1024 / 1024).toFixed(1)} MB` : '알 수 없음'}
              </p>
            </div>
            <div>
              <p className="text-ui-label-sm text-on-surface-variant mb-1">상태</p>
              <p className="text-ui-body text-secondary flex items-center gap-1 font-bold">
                <CheckCircle2 size={16} /> 열림
              </p>
            </div>
          </div>

          <div className="bg-surface-variant/30 p-4 rounded-lg mt-2">
            <p className="text-ui-label-bold text-on-surface mb-2">기록 데이터</p>
            <div className="flex items-center justify-between text-ui-body text-on-surface-variant">
              <span>작성한 메모</span>
              <span className="font-bold text-primary">{memoCount}개</span>
            </div>
            <div className="flex items-center justify-between text-ui-body text-on-surface-variant mt-2">
              <span>저장된 책갈피</span>
              <span className="font-bold text-primary">{bookmarkCount}개</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
