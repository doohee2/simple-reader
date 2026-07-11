"use client";

import { X, FileText, Download, AlertTriangle, Loader2 } from "lucide-react";
import { DownloadState } from "@/hooks/usePdfFile";

interface DownloadProgressModalProps {
  downloadState: DownloadState;
  progress: number;
  loadedBytes: number;
  totalBytes: number;
  fileName: string | null;
  error: string | null;
  onConfirmDirect: () => void;
  onConfirmProxy: () => void;
  onCancel: () => void;
}

export default function DownloadProgressModal({
  downloadState,
  progress,
  loadedBytes,
  totalBytes,
  fileName,
  error,
  onConfirmDirect,
  onConfirmProxy,
  onCancel,
}: DownloadProgressModalProps) {
  if (downloadState === "idle" || downloadState === "success") {
    return null;
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "알 수 없음";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-md rounded-xl shadow-2xl border border-outline-variant flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-outline-variant bg-surface-container-low">
          <h2 className="text-ui-body text-on-surface flex items-center gap-2 font-bold">
            <Download size={20} className="text-primary" />
            파일 다운로드
          </h2>
          {downloadState !== "downloading" && (
            <button onClick={onCancel} className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary-container text-on-primary-container shrink-0">
              <FileText size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-ui-label-bold text-on-surface break-all" title={fileName || ""}>
                {fileName || "알 수 없는 파일"}
              </p>
              <p className="text-ui-label-sm text-on-surface-variant mt-1">
                용량: {formatSize(totalBytes)}
              </p>
            </div>
          </div>

          {downloadState === "confirm" && (
            <div className="text-ui-body text-on-surface-variant">
              이 파일을 기기에 다운로드하여 열겠습니까? <br />
              <span className="text-sm">직접 다운로드 방식을 사용하여 빠르게 가져옵니다.</span>
            </div>
          )}

          {downloadState === "downloading" && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-ui-label-sm font-bold text-primary">
                <span>다운로드 중...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-right text-xs text-on-surface-variant">
                {formatSize(loadedBytes)} / {formatSize(totalBytes)}
              </div>
            </div>
          )}

          {downloadState === "proxy_confirm" && (
            <div className="p-4 bg-error-container/20 border border-error/50 rounded-lg flex flex-col gap-2">
              <div className="flex items-center gap-2 text-error font-bold text-ui-label-bold">
                <AlertTriangle size={18} />
                <span>직접 다운로드 실패</span>
              </div>
              <p className="text-ui-label-sm text-on-surface-variant">
                {error || "보안 정책(CORS) 또는 권한 문제로 직접 다운로드에 실패했습니다."}
              </p>
              <p className="text-ui-label-sm text-on-surface-variant mt-2 border-t border-error/20 pt-2">
                프록시 서버(Vercel)를 경유하여 다운로드하시겠습니까? <br />
                <span className="text-error/80">(서버 대역폭이 소진될 수 있습니다.)</span>
              </p>
            </div>
          )}

          {downloadState === "error" && (
            <div className="p-4 bg-error-container text-on-error-container rounded-lg flex flex-col gap-2 text-sm">
              <div className="font-bold flex items-center gap-2">
                <X size={16} /> 오류 발생
              </div>
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Footer / Actions */}
        <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-2">
          {downloadState === "downloading" ? (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-ui-label-bold text-error hover:bg-error/10 rounded-lg transition-colors flex items-center gap-2"
            >
              <Loader2 size={16} className="animate-spin" />
              취소
            </button>
          ) : (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-2 text-ui-label-bold text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors"
              >
                취소
              </button>
              
              {downloadState === "confirm" && (
                <button
                  onClick={onConfirmDirect}
                  className="px-6 py-2 text-ui-label-bold bg-primary text-on-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors"
                >
                  다운로드 시작
                </button>
              )}

              {downloadState === "proxy_confirm" && (
                <button
                  onClick={onConfirmProxy}
                  className="px-6 py-2 text-ui-label-bold bg-error text-on-error hover:bg-error/90 rounded-lg shadow-sm transition-colors"
                >
                  프록시로 다운로드
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
