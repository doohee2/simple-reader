"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { usePdfFile } from "@/hooks/usePdfFile";
import { useMetadataSync } from "@/hooks/useMetadataSync";

const LazyPage = React.memo(({ pageNumber, scale, containerWidth, onIntersect }: { pageNumber: number, scale: number, containerWidth: number, onIntersect: (pageNumber: number) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const renderObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsRendered(true);
        renderObserver.disconnect();
      }
    }, { rootMargin: "1000px 0px" });
    
    renderObserver.observe(el);

    const trackObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        onIntersect(pageNumber);
      }
    }, { rootMargin: "-40% 0px -40% 0px" });
    
    trackObserver.observe(el);

    return () => {
      renderObserver.disconnect();
      trackObserver.disconnect();
    };
  }, [pageNumber, onIntersect]);

  return (
    <div ref={ref} className="mb-4 flex justify-center min-h-[600px] w-full relative">
      {isRendered ? (
        <div className="shadow-xl bg-white transition-transform origin-top">
          <Page
            pageNumber={pageNumber}
            width={containerWidth ? containerWidth - 32 : undefined}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="pdf-page"
            loading={
              <div className="absolute inset-0 flex items-center justify-center bg-surface-container">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            }
          />
        </div>
      ) : (
        <div className="w-[800px] max-w-full h-[1130px] bg-surface-container shadow-xl animate-pulse" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }} />
      )}
    </div>
  );
});
LazyPage.displayName = "LazyPage";

const workerExt = (pdfjs.version || "3.").startsWith("3.") ? "min.js" : "mjs";
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version || "3.11.174"}/build/pdf.worker.${workerExt}`;

export default function PdfViewer() {
  const { selectedFileId, setSelectedText, clearSelectedText, setActionIntent, viewMode, toggleViewMode } = useStore();
  const { fileData, isLoading, error } = usePdfFile(selectedFileId);

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [nativeScale, setNativeScale] = useState<number>(1.0); // 1.0 = fit to width
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  const handleIntersect = useCallback((page: number) => {
    setPageNumber(page);
  }, []);

  // 책갈피 저장/해제 (Toggle)
  const { metadataList, saveMetadata, deleteMetadata } = useMetadataSync(selectedFileId);
  const existingBookmark = metadataList.find(m => m.page === pageNumber && m.type === "bookmark");
  const isBookmarked = !!existingBookmark;

  const handleToggleBookmark = () => {
    if (isBookmarked) {
      deleteMetadata(existingBookmark.id);
    } else {
      saveMetadata(pageNumber, "bookmark", "", `페이지 ${pageNumber} 책갈피`);
    }
  };

  if (!selectedFileId) {
    return (
      <section className="flex-1 flex items-center justify-center bg-surface-container-lowest h-full text-on-surface-variant">
        상단 &apos;드라이브 파일 열기&apos;를 통해 PDF를 선택해 주세요.
      </section>
    );
  }

  return (
    <TransformWrapper
      initialScale={1}
      minScale={0.5}
      maxScale={4}
      panning={{ disabled: true }} // Disable JS panning to allow native scroll
      wheel={{ wheelDisabled: true }} // Disable wheel zoom to allow native vertical scroll
      pinch={{ step: 5 }}
      doubleClick={{ disabled: true }}
      onZoomStop={(ref) => {
        const cssScale = ref.state.scale;
        if (Math.abs(cssScale - 1) > 0.05) {
          const el = containerRef.current;
          const scrollY = el ? el.scrollTop : 0;
          const scrollX = el ? el.scrollLeft : 0;
          
          setNativeScale(prev => {
            const next = Math.min(Math.max(0.5, prev * cssScale), 4.0);
            const ratio = next / prev;
            
            requestAnimationFrame(() => {
              if (el) {
                el.scrollTop = scrollY * ratio;
                el.scrollLeft = scrollX * ratio;
              }
            });
            return next;
          });
          ref.resetTransform(0);
        }
      }}
    >
      {({ state }) => (
        <section className="flex-1 flex flex-col min-w-[300px] bg-surface-container-lowest relative h-full">
          {/* Toolbar */}
          <div className="h-12 bg-surface-container-low border-b border-outline-variant flex items-center justify-between px-2 md:px-4 flex-shrink-0">
            <div className="flex items-center gap-1 md:gap-2">
              <button
                onClick={toggleViewMode}
                className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
                title={viewMode === "single" ? "연속해서 보기" : "한 페이지씩 보기"}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {viewMode === "single" ? "view_stream" : "article"}
                </span>
                <span className="hidden md:inline text-ui-label-sm font-bold">
                  {viewMode === "single" ? "연속" : "단일"}
                </span>
              </button>
              
              <div className="w-px h-4 bg-outline-variant mx-1 md:mx-2"></div>

              {viewMode === "single" && (
                <button
                  onClick={previousPage}
                  disabled={pageNumber <= 1}
                  className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-xl">chevron_left</span>
                </button>
              )}
              <span className="text-ui-label-bold text-on-surface-variant w-16 md:w-20 text-center">
                {pageNumber} / {numPages || "-"}
              </span>
              {viewMode === "single" && (
                <button
                  onClick={nextPage}
                  disabled={pageNumber >= numPages}
                  className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-xl">chevron_right</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-1 md:gap-2 bg-surface-container px-2 py-1 rounded">
                <button onClick={() => setNativeScale(s => Math.max(s - 0.2, 0.5))} className="p-1 text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <span className="text-ui-label-sm text-on-surface w-10 md:w-12 text-center">
                  {Math.round(nativeScale * state.scale * 100)}%
                </span>
                <button onClick={() => setNativeScale(s => Math.min(s + 0.2, 4.0))} className="p-1 text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
                <div className="w-px h-3 bg-outline-variant mx-0.5"></div>
                <button onClick={() => setNativeScale(1.0)} className="p-1 text-on-surface-variant hover:text-on-surface" title="가로 폭에 맞추기">
                  <span className="material-symbols-outlined text-[18px]">fit_screen</span>
                </button>
              </div>
              <button 
                onClick={handleToggleBookmark}
                className={`p-1.5 rounded transition-colors ${isBookmarked ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'}`}
              >
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
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
                setActionIntent("translate");
                setTooltipPos(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-surface-variant text-primary font-ui-label-bold text-ui-label-sm transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              번역하기
            </button>
            <div className="w-px h-4 bg-outline-variant mx-1"></div>
            <button 
              onClick={() => {
                setActionIntent("memo");
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
          <TransformComponent 
            wrapperStyle={{ width: "100%", height: "max-content", overflow: "visible" }} 
            contentStyle={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            <Document
              file={fileData}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<Loader2 size={40} className="animate-spin text-primary m-10" />}
              error={<div className="p-4 text-error">문서를 렌더링할 수 없습니다.</div>}
            >
              {viewMode === "single" ? (
                <div className="shadow-2xl bg-white transition-transform origin-top">
                  <Page
                    pageNumber={pageNumber}
                    width={containerWidth ? containerWidth - 32 : undefined}
                    scale={nativeScale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="pdf-page"
                  />
                </div>
              ) : (
                Array.from({ length: numPages }, (_, i) => (
                  <LazyPage 
                    key={i + 1} 
                    pageNumber={i + 1} 
                    scale={nativeScale} 
                    containerWidth={containerWidth}
                    onIntersect={handleIntersect} 
                  />
                ))
              )}
            </Document>
          </TransformComponent>
        )}
      </div>
    </section>
  )}
</TransformWrapper>
  );
}
