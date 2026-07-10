"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Bookmark, Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { usePdfFile } from "@/hooks/usePdfFile";
import { useMetadataSync } from "@/hooks/useMetadataSync";

// 워커 설정 (CDN 방식)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer() {
  const { selectedFileId, setSelectedText, clearSelectedText } = useStore();
  const { fileData, isLoading, error } = usePdfFile(selectedFileId);

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const containerRef = useRef<HTMLDivElement>(null);

  // 페이지 전환이나 바깥 영역 클릭 시 선택된 텍스트 초기화
  const handleCleanupSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    clearSelectedText();
  }, [clearSelectedText]);

  // Document 로드 성공 핸들러
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    handleCleanupSelection();
  };

  // 텍스트 선택(드래그) 이벤트 핸들러
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      setSelectedText(text, pageNumber);
    }
  };

  // 배경 클릭 시 선택 영역 해제
  const handleBackgroundClick = (e: React.MouseEvent) => {
    // 텍스트 영역 밖을 클릭했다고 판단될 때만 클린업
    if (e.target === e.currentTarget) {
      handleCleanupSelection();
    }
  };

  // 페이지 변경 시 클린업
  const changePage = (offset: number) => {
    handleCleanupSelection();
    setPageNumber((prevPageNumber) => prevPageNumber + offset);
  };
  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  // 줌 인/아웃
  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3.0));
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));

  // 책갈피 저장
  const { saveMetadata } = useMetadataSync(selectedFileId);
  const handleAddBookmark = () => {
    saveMetadata(pageNumber, "bookmark", "", `페이지 ${pageNumber} 책갈피`);
  };

  if (!selectedFileId) {
    return (
      <section className="flex-1 flex items-center justify-center bg-surface-container-lowest h-full text-on-surface-variant">
        상단 '드라이브 파일 열기'를 통해 PDF를 선택해 주세요.
      </section>
    );
  }

  return (
    <section className="flex-1 flex flex-col min-w-[300px] bg-surface-container-lowest relative h-full">
      {/* Toolbar */}
      <div className="h-12 bg-surface-container-low border-b border-outline-variant flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={previousPage}
            disabled={pageNumber <= 1}
            className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-ui-label-bold text-on-surface-variant w-20 text-center">
            {pageNumber} / {numPages || "-"}
          </span>
          <button
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-surface-container px-2 py-1 rounded">
            <button onClick={zoomOut} className="p-1 text-on-surface-variant hover:text-on-surface">
              <ZoomOut size={18} />
            </button>
            <span className="text-ui-label-sm text-on-surface w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={zoomIn} className="p-1 text-on-surface-variant hover:text-on-surface">
              <ZoomIn size={18} />
            </button>
          </div>
          <button 
            onClick={handleAddBookmark}
            className="p-1.5 rounded text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <Bookmark size={20} className="fill-primary" />
          </button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex justify-center bg-surface-dim items-start"
        onClick={handleBackgroundClick}
        onMouseUp={handleMouseUp}
      >
        {isLoading && (
          <div className="flex flex-col items-center justify-center mt-20 text-primary">
            <Loader2 size={40} className="animate-spin mb-4" />
            <p>PDF를 불러오는 중...</p>
          </div>
        )}
        
        {error && (
          <div className="p-4 bg-error-container/20 border border-error text-error rounded-lg mt-10">
            {error}
          </div>
        )}

        {!isLoading && !error && fileData && (
          <div className="shadow-2xl bg-white transition-transform origin-top">
            <Document
              file={fileData}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<Loader2 size={40} className="animate-spin text-primary m-10" />}
              error={<div className="p-4 text-error">문서를 렌더링할 수 없습니다.</div>}
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="pdf-page"
              />
            </Document>
          </div>
        )}
      </div>
    </section>
  );
}
