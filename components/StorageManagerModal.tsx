"use client";

import { useState, useEffect } from "react";
import { X, Library, Trash2, FileText, CheckCircle2, Clock, Monitor, Cloud } from "lucide-react";
import { getStorageStats, deletePdfCache, clearAllPdfCaches, StorageStat } from "@/lib/db";
import db from "@/lib/db";
import { useStore } from "@/store/useStore";
import { useSession } from "next-auth/react";
import { fetchWithSessionRetry } from "@/lib/fetchWithSessionRetry";

interface StorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StorageManagerModal({ isOpen, onClose }: StorageManagerModalProps) {
  const { setSelectedFile } = useStore();
  const { data: session } = useSession();
  const [stats, setStats] = useState<StorageStat[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getStorageStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load storage stats", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleDeleteItem = async (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    if (confirm("이 항목의 데이터(캐시 및 모든 메모/책갈피)를 삭제하시겠습니까?")) {
      await deletePdfCache(fileId);
      await db.pdfMetadata.where({ fileId }).delete();
      if (session?.user?.id) {
        await fetchWithSessionRetry(`/api/metadata/sync?fileId=${fileId}`, { method: "DELETE" });
      }
      await loadStats();
    }
  };

  const handleClearAll = async () => {
    if (confirm("로컬의 저장된 pdf 이북과 메타데이터는 모두 삭제됩니다. 진행하시겠습니까?")) {
      await clearAllPdfCaches();
      await db.pdfMetadata.clear();
      if (session?.user?.id) {
        await fetchWithSessionRetry(`/api/metadata/sync`, { method: "DELETE" });
      }
      await loadStats();
    }
  };

  const handleSelectFile = (stat: StorageStat) => {
    setSelectedFile(stat.fileId, stat.fileName || '알 수 없는 파일', stat.fileSize || null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-3xl rounded-xl shadow-2xl border border-outline-variant flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-outline-variant">
          <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
            <Library className="text-primary" size={24} />
            내 서재
            <span className="text-ui-label-sm text-on-surface-variant font-normal ml-2 hidden sm:inline">로컬에 저장된 데이터를 관리</span>
          </h2>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handleClearAll}
              disabled={stats.length === 0}
              className="flex items-center gap-1 sm:gap-2 text-ui-label-bold text-error hover:bg-error/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded transition-colors border border-error/20 disabled:opacity-30"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">전체 삭제</span>
              <span className="sm:hidden">전체</span>
            </button>
            <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-surface-dim">
          {loading ? (
            <div className="flex justify-center py-12 text-primary">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : stats.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant text-ui-body">
              저장된 캐시나 메타데이터가 없습니다.
            </div>
          ) : (
            <ul className="space-y-4">
              {stats.map((stat) => (
                <li 
                  key={stat.fileId} 
                  onClick={() => handleSelectFile(stat)}
                  className="bg-surface rounded-xl border border-outline-variant p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-primary/50 hover:bg-surface-variant/30 transition-all cursor-pointer group"
                >
                  
                  {/* Info Section */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`hidden sm:flex p-3 rounded-lg flex-shrink-0 ${stat.isCached ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                      <FileText size={24} />
                    </div>
                    
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-ui-label-bold text-on-surface group-hover:text-primary transition-colors" title={stat.fileName || stat.fileId}>
                          {stat.fileName || '알 수 없는 파일'}
                        </p>
                        {stat.fileSize && (
                          <span className="text-ui-label-sm text-on-surface-variant">
                            ({(stat.fileSize / 1024 / 1024).toFixed(1)} MB)
                          </span>
                        )}
                        
                        {/* Status Badge */}
                        {stat.fileId.startsWith('local-') ? (
                          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[10px] font-bold">
                            <Monitor size={12} /> 기기 파일 (오프라인 전용)
                          </span>
                        ) : stat.isCached ? (
                          <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded text-[10px] font-bold">
                            <CheckCircle2 size={12} /> 드라이브 (캐시됨)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-bold">
                            <Cloud size={12} /> 드라이브에만 있음
                          </span>
                        )}
                      </div>
                      
                      {/* Meta Stats */}
                      <div className="flex items-center gap-3 text-ui-label-sm text-on-surface-variant">
                        <span>메모 {stat.memoCount}개</span>
                        <span className="w-1 h-1 bg-outline rounded-full"></span>
                        <span>책갈피 {stat.bookmarkCount}개</span>
                        <span className="w-1 h-1 bg-outline rounded-full"></span>
                        <span>{new Date(stat.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end z-10 shrink-0">
                    <button
                      onClick={(e) => handleDeleteItem(e, stat.fileId)}
                      className="flex items-center gap-1.5 text-ui-label-sm text-error hover:bg-error/10 border border-error/30 px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                    >
                      <Trash2 size={14} />
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
