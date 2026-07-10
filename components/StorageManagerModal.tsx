"use client";

import { useState, useEffect } from "react";
import { X, HardDrive, Trash2, Database, FileText, CheckCircle2, Clock } from "lucide-react";
import { getStorageStats, deletePdfCache, clearAllPdfCaches, StorageStat } from "@/lib/db";

interface StorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StorageManagerModal({ isOpen, onClose }: StorageManagerModalProps) {
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

  const handleDeleteCache = async (fileId: string) => {
    if (confirm("이 파일의 캐시(PDF 데이터)를 기기에서 삭제하시겠습니까?\n작성한 메모와 책갈피는 유지됩니다.")) {
      await deletePdfCache(fileId);
      await loadStats();
    }
  };

  const handleClearAll = async () => {
    if (confirm("모든 파일의 캐시를 삭제하시겠습니까?\n작성한 메모와 책갈피는 안전하게 유지됩니다.")) {
      await clearAllPdfCaches();
      await loadStats();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-3xl rounded-xl shadow-2xl border border-outline-variant flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-outline-variant">
          <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
            <Database className="text-primary" size={24} />
            로컬 저장소 관리
          </h2>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-surface-container-lowest px-6 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
          <p className="text-ui-label-sm text-on-surface-variant">
            기기에 임시 저장된 PDF 캐시 용량을 관리합니다.
          </p>
          <button
            onClick={handleClearAll}
            disabled={stats.every(s => !s.isCached)}
            className="flex items-center gap-2 text-ui-label-bold text-error hover:bg-error/10 px-4 py-2 rounded transition-colors border border-error/20 disabled:opacity-30"
          >
            <Trash2 size={16} />
            전체 캐시 비우기
          </button>
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
                <li key={stat.fileId} className="bg-surface rounded-xl border border-outline-variant p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-primary/30 transition-colors">
                  
                  {/* Info Section */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`p-3 rounded-lg flex-shrink-0 ${stat.isCached ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                      <FileText size={24} />
                    </div>
                    
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-ui-label-bold text-on-surface truncate" title={stat.fileId}>
                          {stat.fileId.substring(0, 16)}...
                        </p>
                        
                        {/* Status Badge */}
                        {stat.isCached ? (
                          <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded text-[10px] font-bold">
                            <CheckCircle2 size={12} /> 캐시됨
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-bold">
                            <Clock size={12} /> 드라이브에만 있음
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
                  <div className="flex items-center justify-end">
                    {stat.isCached ? (
                      <button
                        onClick={() => handleDeleteCache(stat.fileId)}
                        className="flex items-center gap-1.5 text-ui-label-sm text-error hover:bg-error/10 border border-error/30 px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                      >
                        <Trash2 size={14} />
                        캐시 삭제
                      </button>
                    ) : (
                      <span className="text-ui-label-sm text-on-surface-variant px-3 py-1.5 whitespace-nowrap">
                        캐시 없음
                      </span>
                    )}
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
