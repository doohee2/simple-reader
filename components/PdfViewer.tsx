"use client";

import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { usePdfFile } from "@/hooks/usePdfFile";
import { useMetadataSync } from "@/hooks/useMetadataSync";
import db from "@/lib/db";
import DownloadProgressModal from "./DownloadProgressModal";
import { EMPTY_STATE_MESSAGE } from "@/lib/constants";

const LazyPage = React.memo(({ 
  pageNumber, 
  zoomMode,
  customScale,
  containerWidth, 
  pageBaseWidth,
  onIntersect,
  onPageLoadSuccess
}: { 
  pageNumber: number, 
  zoomMode: "fit" | "custom",
  customScale: number,
  containerWidth: number, 
  pageBaseWidth: number,
  onIntersect: (pageNumber: number) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPageLoadSuccess: (page: any) => void
}) => {
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

  const effectiveWidth = zoomMode === "fit" ? (containerWidth ? containerWidth - 32 : undefined) : undefined;
  const effectiveScale = zoomMode === "fit" ? undefined : customScale;

  const expectedWidth = zoomMode === "fit" 
    ? (containerWidth ? containerWidth - 32 : 800) 
    : (pageBaseWidth || 800) * customScale;
  const expectedHeight = expectedWidth * 1.414;

  return (
    <div id={`page-${pageNumber}`} ref={ref} className={`mb-4 flex ${zoomMode === "fit" ? "justify-center" : "justify-start"} min-h-[600px] w-full relative`}>
      {isRendered ? (
        <div className="shadow-xl bg-white transition-transform origin-top">
          <Page
            pageNumber={pageNumber}
            width={effectiveWidth}
            scale={effectiveScale}
            onLoadSuccess={onPageLoadSuccess}
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
        <div 
          className="bg-surface-container shadow-xl animate-pulse" 
          style={{ width: expectedWidth, height: expectedHeight }}
        />
      )}
    </div>
  );
});
LazyPage.displayName = "LazyPage";

const workerExt = (pdfjs.version || "3.").startsWith("3.") ? "min.js" : "mjs";
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version || "3.11.174"}/build/pdf.worker.${workerExt}`;

export default function PdfViewer() {
  const { selectedFileId, selectedFileName, setSelectedText, clearSelectedText, setActionIntent, viewMode, toggleViewMode, targetPage, setTargetPage } = useStore();
  const { 
    fileData, 
    isLoading, 
    downloadState, 
    progress, 
    loadedBytes, 
    totalBytes, 
    error, 
    startDirectDownload, 
    startProxyDownload, 
    cancelDownload 
  } = usePdfFile(selectedFileId);

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoomMode, setZoomMode] = useState<"fit" | "custom">("fit");
  const [customScale, setCustomScale] = useState<number>(1.0);
  const [pageBaseWidth, setPageBaseWidth] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformRef = useRef<any>(null);
  
  const ignoreIntersectRef = useRef(false);
  const pendingScrollRef = useRef<{ x: number; y: number } | null>(null);
  const pendingResetTransformRef = useRef(false);
  const scaleDisplayRef = useRef<HTMLSpanElement>(null);
  
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const [isQuickZoomed, setIsQuickZoomed] = useState(false);
  const quickZoomOriginalRef = useRef<{ scale: number; zoomMode: "fit" | "custom" } | null>(null);
  const lastClickRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const stateRef = useRef<{ currentScale: number; zoomMode: "fit" | "custom"; customScale: number; fitScale: number }>({ currentScale: 1, zoomMode: "fit", customScale: 1, fitScale: 1 });

  useLayoutEffect(() => {
    if (pendingResetTransformRef.current) {
      transformRef.current?.resetTransform(0);
      pendingResetTransformRef.current = false;
    }
    if (pendingScrollRef.current && containerRef.current) {
      containerRef.current.scrollLeft = pendingScrollRef.current.x;
      containerRef.current.scrollTop = pendingScrollRef.current.y;
      pendingScrollRef.current = null;
    }
  }, [customScale, zoomMode]);

  useLayoutEffect(() => {
    if (scaleDisplayRef.current) {
      const fitScale = (containerWidth && pageBaseWidth) ? (containerWidth - 32) / pageBaseWidth : 1;
      const cScale = zoomMode === "fit" ? fitScale : customScale;
      scaleDisplayRef.current.innerText = `${Math.round(cScale * 100)}%`;
    }
  }, [customScale, zoomMode, containerWidth, pageBaseWidth]);

  const scrollToPage = useCallback((p: number, isContinuous: boolean, delay = 0) => {
    if (!isContinuous) return;
    
    ignoreIntersectRef.current = true;
    setTimeout(() => {
      const el = document.getElementById(`page-${p}`);
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
      }
      setTimeout(() => {
        ignoreIntersectRef.current = false;
      }, 200);
    }, delay);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedFileId]);

  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");

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
  const onDocumentLoadSuccess = async ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setZoomMode("fit");
    setPageBaseWidth(0); // Reset for new document
    handleCleanupSelection();

    // 마지막 책갈피 위치로 이동
    if (selectedFileId) {
      try {
        const localData = await db.pdfMetadata.where("fileId").equals(selectedFileId).toArray();
        const bookmarks = localData.filter(m => m.type === "bookmark");
        if (bookmarks.length > 0) {
          bookmarks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          const latestBookmarkPage = bookmarks[0].page;
          setPageNumber(latestBookmarkPage);
          
          scrollToPage(latestBookmarkPage, viewMode === "continuous", 500);
          return;
        }
      } catch (err) {
        console.error("최근 책갈피 조회 실패:", err);
      }
    }
    
    setPageNumber(1);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onPageLoadSuccess = useCallback((page: any) => {
    if (pageBaseWidth === 0) {
      const width = page.originalWidth || page.getViewport?.({ scale: 1 })?.width || 800;
      setPageBaseWidth(width);
    }
  }, [pageBaseWidth]);

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

  const handleDoubleClick = (clientX: number, clientY: number) => {
    if (!pdfWrapperRef.current || !containerRef.current) return;
    
    const { currentScale, customScale, zoomMode } = stateRef.current;
    
    if (isQuickZoomed && quickZoomOriginalRef.current) {
      const rect = pdfWrapperRef.current.getBoundingClientRect();
      const docX = clientX - rect.left;
      const docY = clientY - rect.top;
      
      const targetScale = quickZoomOriginalRef.current.scale;
      const ratio = targetScale / currentScale;
      
      setIsQuickZoomed(false);
      setZoomMode(quickZoomOriginalRef.current.zoomMode);
      setCustomScale(targetScale);
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newDocY = docY * ratio;
      
      if (quickZoomOriginalRef.current.zoomMode === "fit") {
        pendingScrollRef.current = { x: 0, y: newDocY + containerRect.top + 16 - clientY };
      } else {
        const newDocX = docX * ratio;
        pendingScrollRef.current = {
          x: newDocX + containerRect.left + 16 - clientX,
          y: newDocY + containerRect.top + 16 - clientY
        };
      }
      pendingResetTransformRef.current = true;
    } else {
      const rect = pdfWrapperRef.current.getBoundingClientRect();
      const docX = clientX - rect.left;
      const docY = clientY - rect.top;
      
      const targetScale = Math.min(currentScale * 2, 8.0);
      const ratio = targetScale / currentScale;
      
      const newDocX = docX * ratio;
      const newDocY = docY * ratio;
      
      quickZoomOriginalRef.current = { scale: customScale, zoomMode };
      setIsQuickZoomed(true);
      
      setZoomMode("custom");
      setCustomScale(targetScale);
      
      const containerRect = containerRef.current.getBoundingClientRect();
      pendingScrollRef.current = {
        x: newDocX + containerRect.left + 16 - clientX,
        y: newDocY + containerRect.top + 16 - clientY
      };
      pendingResetTransformRef.current = true;
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      if (e.target === e.currentTarget) {
        handleCleanupSelection();
      }
      return;
    }
    
    if (e.target === e.currentTarget) {
      handleCleanupSelection();
    }
    if (tooltipPos) {
      setTooltipPos(null);
    }

    const now = Date.now();
    if (lastClickRef.current && now - lastClickRef.current.time < 300) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      lastClickRef.current = null;
      handleDoubleClick(e.clientX, e.clientY);
      return;
    }

    lastClickRef.current = { time: now, x: e.clientX, y: e.clientY };

    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null;
      const { zoomMode } = stateRef.current;
      if (viewMode === "single" && zoomMode === "fit" && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        
        if (clickX < width * 0.2) {
          if (pageNumber > 1) previousPage();
        } else if (clickX > width * 0.8) {
          if (pageNumber < numPages) nextPage();
        }
      }
    }, 300);
  };

  // 페이지 변경 시 클린업
  const changePage = (offset: number) => {
    handleCleanupSelection();
    setPageNumber((prevPageNumber) => prevPageNumber + offset);
  };
  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);
  
  const handleToggleViewMode = () => {
    setIsQuickZoomed(false);
    const nextMode = viewMode === "single" ? "continuous" : "single";
    toggleViewMode();
    transformRef.current?.resetTransform(0);
    
    if (nextMode === "continuous") {
      scrollToPage(pageNumber, true, 0);
    } else {
      if (containerRef.current) containerRef.current.scrollTop = 0;
    }
  };

  const handleIntersect = useCallback((page: number) => {
    if (ignoreIntersectRef.current) return;
    // 편집 모드가 아닐 때만 스크롤 페이지 감지 업데이트
    if (!isEditingPage) {
      setPageNumber(page);
    }
  }, [isEditingPage]);

  // 페이지 직접 입력 관련 핸들러
  const handlePageInputBlur = () => {
    const p = parseInt(pageInput);
    if (!isNaN(p) && p >= 1 && p <= numPages) {
      setPageNumber(p);
      scrollToPage(p, viewMode === "continuous");
    }
    setIsEditingPage(false);
  };

  // 책갈피 저장/해제 (Toggle)
  const { metadataList, saveMetadata, deleteMetadata } = useMetadataSync(selectedFileId);
  const existingBookmark = metadataList.find(m => m.page === pageNumber && m.type === "bookmark");
  const isBookmarked = !!existingBookmark;

  const handleToggleBookmark = async () => {
    if (!selectedFileId) return;
    if (isBookmarked) {
      await deleteMetadata(existingBookmark.id);
    } else {
      await saveMetadata(pageNumber, "bookmark", "", "책갈피");
    }
  };

  // targetPage 감지 시 해당 페이지로 이동
  useEffect(() => {
    if (targetPage !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPageNumber(targetPage);
      scrollToPage(targetPage, viewMode === "continuous");
      setTargetPage(null);
    }
  }, [targetPage, viewMode, setTargetPage, scrollToPage]);

  if (!selectedFileId) {
    return (
      <section className="flex-1 flex items-center justify-center bg-surface-container-lowest h-full text-on-surface-variant p-4 text-center">
        {EMPTY_STATE_MESSAGE}
      </section>
    );
  }

  const fitScale = (containerWidth && pageBaseWidth) ? (containerWidth - 32) / pageBaseWidth : 1;
  const currentScale = zoomMode === "fit" ? fitScale : customScale;
  
  stateRef.current = { currentScale, zoomMode, customScale, fitScale };

  return (
    <TransformWrapper
      ref={transformRef}
      initialScale={1}
      minScale={0.25 / currentScale}
      maxScale={8.0 / currentScale}
      panning={{ 
        disabled: true, 
      }}
      wheel={{ wheelDisabled: true }} // Disable wheel zoom to allow native vertical scroll
      pinch={{ step: 5 }}
      doubleClick={{ disabled: true }}
      onTransform={(ref, state) => {
        if (pendingResetTransformRef.current) return;
        if (scaleDisplayRef.current) {
          const { currentScale } = stateRef.current;
          const perceived = currentScale * state.scale;
          const bounded = Math.min(Math.max(0.25, perceived), 8.0);
          scaleDisplayRef.current.innerText = `${Math.round(bounded * 100)}%`;
        }
      }}
      onZoomStop={(ref) => {
        setIsQuickZoomed(false);
        const { currentScale, zoomMode, customScale, fitScale } = stateRef.current;
        const cssScale = ref.state.scale;
        const posX = ref.state.positionX;
        const posY = ref.state.positionY;
        if (Math.abs(cssScale - 1) > 0.001 || Math.abs(posX) > 0 || Math.abs(posY) > 0) {
          const el = containerRef.current;
          const scrollY = el ? el.scrollTop : 0;
          const scrollX = el ? el.scrollLeft : 0;
          
          const newScale = Math.min(Math.max(0.25, currentScale * cssScale), 8.0);
          
          const wasFit = zoomMode === "fit";
          const xOffset = wasFit ? (16 * cssScale) : 0;
          
          if (newScale === customScale && zoomMode === "custom") {
            // No React render needed, reset instantly to prevent bounce animation
            transformRef.current?.resetTransform(0);
            if (el) {
              el.scrollLeft = scrollX - posX - xOffset;
              el.scrollTop = scrollY - posY;
            }
          } else {
            setZoomMode("custom");
            setCustomScale(newScale);
            
            pendingScrollRef.current = {
              x: scrollX - posX - xOffset,
              y: scrollY - posY
            };
            
            pendingResetTransformRef.current = true;
          }
        }
      }}
      onPinchStop={(ref) => {
        setIsQuickZoomed(false);
        const { currentScale, zoomMode, customScale, fitScale } = stateRef.current;
        const cssScale = ref.state.scale;
        const posX = ref.state.positionX;
        const posY = ref.state.positionY;
        if (Math.abs(cssScale - 1) > 0.001 || Math.abs(posX) > 0 || Math.abs(posY) > 0) {
          const el = containerRef.current;
          const scrollY = el ? el.scrollTop : 0;
          const scrollX = el ? el.scrollLeft : 0;
          
          const newScale = Math.min(Math.max(0.25, currentScale * cssScale), 8.0);
          
          const wasFit = zoomMode === "fit";
          const xOffset = wasFit ? (16 * cssScale) : 0;
          
          if (newScale === customScale && zoomMode === "custom") {
            transformRef.current?.resetTransform(0);
            if (el) {
              el.scrollLeft = scrollX - posX - xOffset;
              el.scrollTop = scrollY - posY;
            }
          } else {
            setZoomMode("custom");
            setCustomScale(newScale);
            
            pendingScrollRef.current = {
              x: scrollX - posX - xOffset,
              y: scrollY - posY
            };
            
            pendingResetTransformRef.current = true;
          }
        }
      }}
    >
      {({ state }) => {
        const displayedScale = stateRef.current.zoomMode === "fit" ? stateRef.current.fitScale : stateRef.current.customScale;
        
        const handleZoomIn = () => {
          setIsQuickZoomed(false);
          const { currentScale } = stateRef.current;
          const perceived = currentScale * state.scale;
          const currentPct = perceived * 100;
          let step = 5;
          if (currentPct >= 200) step = 20;
          else if (currentPct >= 130) step = 10;
          
          let nextPct = Math.ceil((currentPct + 1) / step) * step;
          
          setZoomMode("custom");
          setCustomScale(Math.min(nextPct / 100, 8.0));
          pendingResetTransformRef.current = true;
        };

        const handleZoomOut = () => {
          setIsQuickZoomed(false);
          const { currentScale } = stateRef.current;
          const perceived = currentScale * state.scale;
          const currentPct = perceived * 100;
          let step = 5;
          if (currentPct > 200) step = 20;
          else if (currentPct > 130) step = 10;
          
          let nextPct = Math.floor((currentPct - 1) / step) * step;
          
          setZoomMode("custom");
          setCustomScale(Math.max(nextPct / 100, 0.25));
          pendingResetTransformRef.current = true;
        };

        const handleFit = () => {
          setIsQuickZoomed(false);
          setZoomMode("fit");
          transformRef.current?.resetTransform(0);
        };
        
        return (
        <section className="flex-1 flex flex-col min-w-[300px] bg-surface-container-lowest relative h-full">
          {/* Toolbar */}
          <div className="h-12 bg-surface-container-low border-b border-outline-variant flex items-center justify-between px-2 md:px-4 flex-shrink-0">
            <div className="flex items-center gap-1 md:gap-2">
              <button
                onClick={handleToggleViewMode}
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
              
              <div className="w-px h-4 bg-outline-variant mx-1"></div>

              {viewMode === "single" && (
                <button
                  onClick={previousPage}
                  disabled={pageNumber <= 1}
                  className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-xl">chevron_left</span>
                </button>
              )}
              {isEditingPage ? (
                <div className="flex items-center mx-1">
                  <input
                    autoFocus
                    type="number"
                    className="w-12 h-6 text-center bg-surface border border-primary rounded text-ui-label-bold focus:outline-none"
                    value={pageInput}
                    onChange={e => setPageInput(e.target.value)}
                    onBlur={handlePageInputBlur}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                  <span className="text-ui-label-bold text-on-surface-variant ml-1 text-center whitespace-nowrap">
                    / {numPages || "-"}
                  </span>
                </div>
              ) : (
                <span 
                  onClick={() => { setIsEditingPage(true); setPageInput(pageNumber.toString()); }}
                  className="text-ui-label-bold text-on-surface-variant min-w-[3.5rem] text-center cursor-pointer hover:text-primary transition-colors whitespace-nowrap px-1"
                >
                  {pageNumber} / {numPages || "-"}
                </span>
              )}
              {viewMode === "single" && (
                <button
                  onClick={nextPage}
                  disabled={pageNumber >= numPages}
                  className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-xl">chevron_right</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <div className="flex items-center gap-0.5 md:gap-1 bg-surface-container px-1 py-1 rounded">
                <button 
                  onClick={handleZoomOut} 
                  className="p-1 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <span ref={scaleDisplayRef} className="text-ui-label-sm text-on-surface w-10 text-center whitespace-nowrap">
                </span>
                <button 
                  onClick={handleZoomIn} 
                  className="p-1 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
                <div className="w-px h-3 bg-outline-variant mx-0.5"></div>
                <button onClick={handleFit} className={`p-1 ${zoomMode === "fit" ? "text-primary bg-primary/10 rounded" : "text-on-surface-variant hover:text-on-surface"}`} title="가로 폭에 맞추기">
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
        className={`flex-1 p-4 bg-surface-dim relative ${zoomMode === "fit" ? "overflow-y-auto overflow-x-hidden" : "overflow-auto"}`}
        onClick={handleContainerClick}
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
        
        <DownloadProgressModal
          downloadState={downloadState}
          progress={progress}
          loadedBytes={loadedBytes}
          totalBytes={totalBytes}
          fileName={selectedFileName}
          error={error}
          onConfirmDirect={startDirectDownload}
          onConfirmProxy={startProxyDownload}
          onCancel={cancelDownload}
        />

        {isLoading && (
          <div className="flex flex-col items-center justify-center mt-20 text-primary">
            <Loader2 size={40} className="animate-spin mb-4" />
            <p>PDF를 불러오는 중...</p>
          </div>
        )}
        
        {/* Show error only if it's not handled by the Modal */}
        {error && downloadState !== "proxy_confirm" && downloadState !== "error" && (
          <div className="p-4 bg-error-container/20 border border-error text-error rounded-lg mt-10">
            {error}
          </div>
        )}

        {!isLoading && downloadState === "success" && fileData && (
          <TransformComponent 
            wrapperClass={`!touch-${zoomMode === "fit" ? "pan-y" : "auto"}`}
            wrapperStyle={{ width: "100%", height: "auto", overflow: "visible", touchAction: zoomMode === "fit" ? "pan-y" : "auto", userSelect: "text" }} 
            contentStyle={{ minWidth: "100%", width: "auto", display: "flex", flexDirection: "column", alignItems: zoomMode === "fit" ? "center" : "flex-start", userSelect: "text" }}
            >
              <div 
                ref={pdfWrapperRef}
                onMouseDown={(e) => e.stopPropagation()} 
              onTouchStart={(e) => { if (e.touches.length === 1) e.stopPropagation(); }}
              onTouchMove={(e) => { if (e.touches.length === 1) e.stopPropagation(); }}
              className={`w-full flex flex-col ${zoomMode === "fit" ? "items-center" : "items-start"}`}
            >
              <Document
                file={fileData}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<Loader2 size={40} className="animate-spin text-primary m-10" />}
                error={<div className="p-4 text-error">문서를 렌더링할 수 없습니다.</div>}
                className={`w-full flex flex-col ${zoomMode === "fit" ? "items-center" : "items-start"} pdf-document`}
              >
                {viewMode === "single" ? (
                  <div id={`page-${pageNumber}`} className="shadow-2xl bg-white transition-transform origin-top">
                    <Page
                      pageNumber={pageNumber}
                      width={zoomMode === "fit" ? (containerWidth ? containerWidth - 32 : undefined) : undefined}
                      scale={zoomMode === "fit" ? undefined : customScale}
                      onLoadSuccess={onPageLoadSuccess}
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
                      zoomMode={zoomMode}
                      customScale={customScale}
                      containerWidth={containerWidth}
                      pageBaseWidth={pageBaseWidth}
                      onIntersect={handleIntersect} 
                      onPageLoadSuccess={onPageLoadSuccess}
                    />
                  ))
                )}
              </Document>
            </div>
          </TransformComponent>
        )}
      </div>
    </section>
  )}}
</TransformWrapper>
  );
}
