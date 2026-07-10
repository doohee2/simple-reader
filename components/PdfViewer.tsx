"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { usePdfFile } from "@/hooks/usePdfFile";
import { useMetadataSync } from "@/hooks/useMetadataSync";

const workerExt = (pdfjs.version || "3.").startsWith("3.") ? "min.js" : "mjs";
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version || "3.11.174"}/build/pdf.worker.${workerExt}`;

export default function PdfViewer() {
  const { selectedFileId, setSelectedText, clearSelectedText } = useStore();
  const { fileData, isLoading, error } = usePdfFile(selectedFileId);

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // 페이지 전환이나 바깥 영역 클릭 시 선택된 텍스트 초기화
  const handleCleanupSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    clearSelectedText();
    setTooltipPos(null);
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

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      
      if (containerRect && containerRef.current) {
        setTooltipPos({
          x: rect.left + rect.width / 2 - containerRect.left + containerRef.current.scrollLeft,
          y: rect.top - containerRect.top + containerRef.current.scrollTop - 10
        });
      }
    } else {
      setTooltipPos(null);
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
        상단 &apos;드라이브 파일 열기&apos;를 통해 PDF를 선택해 주세요.
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
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>
          <span className="text-ui-label-bold text-on-surface-variant w-20 text-center">
            {pageNumber} / {numPages || "-"}
          </span>
          <button
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-surface-container px-2 py-1 rounded">
            <button onClick={zoomOut} className="p-1 text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <span className="text-ui-label-sm text-on-surface w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={zoomIn} className="p-1 text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>
          <button 
            onClick={handleAddBookmark}
            className="p-1.5 rounded text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span>
          </button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex justify-center bg-surface-dim items-start relative scroll-smooth"
        onClick={handleBackgroundClick}
        onMouseUp={handleMouseUp}
      >
        {tooltipPos && (
          <div 
            className="absolute z-50 flex items-center gap-1 bg-surface/90 backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.5)] rounded-lg border border-primary/50 p-1.5 animate-in fade-in zoom-in-95 duration-200"
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y - 5}px`,
              transform: 'translate(-50%, -100%)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary/50"></div>
            
            <button 
              onClick={() => {
                setTooltipPos(null);
                // AI 패널에서 사용자가 확인하도록 유도 (이펙트용)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-surface-variant text-primary font-ui-label-bold text-ui-label-sm transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              번역하기
            </button>
            <div className="w-px h-4 bg-outline-variant mx-1"></div>
            <button 
              onClick={() => {
                const { selectedText } = useStore.getState();
                saveMetadata(pageNumber, "memo", selectedText, "");
                setTooltipPos(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-surface-variant text-on-surface-variant hover:text-on-surface font-ui-label-bold text-ui-label-sm transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px]">edit_note</span>
              메모 추가
            </button>
          </div>
        )}
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
