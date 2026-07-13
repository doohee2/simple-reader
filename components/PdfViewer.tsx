"use client";

import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { flushSync } from "react-dom";
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
    <div id={`page-${pageNumber}`} ref={ref} className="mb-4 relative mx-auto w-max min-h-[600px]">
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
  const scaleDisplayRef = useRef<HTMLSpanElement>(null);
  
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const [isQuickZoomed, setIsQuickZoomed] = useState(false);
  const [pinchSpikeThreshold, setPinchSpikeThreshold] = useState<number>(10);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const quickZoomOriginalRef = useRef<{ scale: number; zoomMode: "fit" | "custom" } | null>(null);
  const lastClickRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pinchCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastGoodPinchStateRef = useRef<{ scale: number; positionX: number; positionY: number } | null>(null);
  
  const stateRef = useRef<{ currentScale: number; zoomMode: "fit" | "custom"; customScale: number; fitScale: number }>({ currentScale: 1, zoomMode: "fit", customScale: 1, fitScale: 1 });

  const applyZoomWithAnchor = useCallback((targetScale: number, newZoomMode: "fit" | "custom", anchorClientX?: number, anchorClientY?: number) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    // Determine the viewport anchor if no specific coordinates provided
    const clientX = anchorClientX ?? (container.getBoundingClientRect().left + container.clientWidth / 2);
    const clientY = anchorClientY ?? (container.getBoundingClientRect().top + container.clientHeight / 2);
    
    // 1. Find the page element under the anchor point or closest to it
    let anchorPageEl: HTMLElement | null = (document.elementFromPoint(clientX, clientY)?.closest('.react-pdf__Page') as HTMLElement) || null;
    
    if (!anchorPageEl) {
      const pages = Array.from(document.querySelectorAll('.react-pdf__Page')) as HTMLElement[];
      let closestPage: HTMLElement | null = null;
      let minDistance = Infinity;
      for (const page of pages) {
        const rect = page.getBoundingClientRect();
        
        // 1순위: Y좌표가 해당 페이지 영역 안에 포함되는지 확인
        if (clientY >= rect.top && clientY <= rect.bottom) {
          closestPage = page;
          break;
        }
        
        // 2순위: 가장 가까운 거리 (gap 영역 핀치 대비)
        let distance = 0;
        if (clientY < rect.top) distance = rect.top - clientY;
        else if (clientY > rect.bottom) distance = clientY - rect.bottom;
        
        if (distance < minDistance) {
          minDistance = distance;
          closestPage = page;
        }
      }
      anchorPageEl = closestPage;
    }
    
    if (!anchorPageEl) {
      flushSync(() => {
        setCustomScale(targetScale);
        setZoomMode(newZoomMode);
      });
      return;
    }
    
    // 2. Calculate the relative position of the anchor point inside the page
    const initialPageRect = anchorPageEl.getBoundingClientRect();
    const ratioX = (clientX - initialPageRect.left) / initialPageRect.width;
    const ratioY = (clientY - initialPageRect.top) / initialPageRect.height;
    
    // 3. Clear transform to prevent visual flicker
    const transformComponent = document.querySelector('.react-transform-component') as HTMLElement;
    if (transformComponent) {
      transformComponent.style.transform = "";
    }
    
    // 4. Synchronously update React state and DOM
    flushSync(() => {
      setCustomScale(targetScale);
      setZoomMode(newZoomMode);
    });
    
    // 5. Calculate new scroll positions to restore the anchor point
    const newPageRect = anchorPageEl.getBoundingClientRect();
    const newPointX = newPageRect.left + newPageRect.width * ratioX;
    const newPointY = newPageRect.top + newPageRect.height * ratioY;
    
    const scrollDiffX = newPointX - clientX;
    const scrollDiffY = newPointY - clientY;
    
    container.scrollLeft = Math.max(0, container.scrollLeft + scrollDiffX);
    container.scrollTop = Math.max(0, container.scrollTop + scrollDiffY);
    
    // 6. Synchronize react-zoom-pan-pinch internal state
    transformRef.current?.resetTransform(0);
  }, []);

  useLayoutEffect(() => {
    // legacy pending updates removed, keeping only scale display update
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

  // 모바일 및 PC 통합 텍스트 선택 감지 (selectionchange 이벤트)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleSelectionChange = () => {
      clearTimeout(timeoutId);
      // 디바운스 적용: 사용자가 드래그를 멈추고 300ms 후에 선택 영역을 확정
      timeoutId = setTimeout(() => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
          // 선택된 텍스트가 PDF 컨테이너 내부에 있는지 확인
          if (containerRef.current && containerRef.current.contains(selection.anchorNode)) {
            const text = selection.toString().trim();
            setSelectedText(text, pageNumber);
            
            try {
              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              const containerRect = containerRef.current.getBoundingClientRect();
              
              if (rect.width > 0) {
                setTooltipPos({
                  x: rect.left + rect.width / 2 - containerRect.left + containerRef.current.scrollLeft,
                  y: rect.top - containerRect.top + containerRef.current.scrollTop - 10
                });
              }
            } catch (e) {
              // Range 오류 무시
            }
          }
        } else {
          // 선택이 풀렸을 때 툴팁 숨기기
          // 단, 사용자가 툴팁을 클릭하기 위해 텍스트 이외의 곳을 누르는 상황은 handleCleanupSelection에서 처리하므로
          // 여기서 무조건 null로 만들면 툴팁이 바로 사라질 위험이 있음
        }
      }, 300);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      clearTimeout(timeoutId);
    };
  }, [pageNumber, setSelectedText]);

  const handleDoubleClick = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    
    const { currentScale, customScale, zoomMode } = stateRef.current;
    
    if (isQuickZoomed && quickZoomOriginalRef.current) {
      const targetScale = quickZoomOriginalRef.current.scale;
      setIsQuickZoomed(false);
      applyZoomWithAnchor(targetScale, quickZoomOriginalRef.current.zoomMode, clientX, clientY);
    } else {
      const targetScale = Math.min(currentScale * 2, 8.0);
      const scaleToSave = zoomMode === "fit" ? stateRef.current.fitScale : customScale;
      quickZoomOriginalRef.current = { scale: scaleToSave, zoomMode };
      setIsQuickZoomed(true);
      
      applyZoomWithAnchor(targetScale, "custom", clientX, clientY);
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    // 1. 가장자리 탭 페이지 넘김: 300ms 대기 없이 즉시 실행
    const { zoomMode: currentZoomMode } = stateRef.current;
    if (viewMode === "single" && currentZoomMode === "fit" && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      
      if (clickX < width * 0.2) {
        if (pageNumber > 1) previousPage();
        return;
      } else if (clickX > width * 0.8) {
        if (pageNumber < numPages) nextPage();
        return;
      }
    }

    // 2. 더블클릭 판정 (텍스트 선택 여부와 무관하게 작동)
    const now = Date.now();
    if (lastClickRef.current && now - lastClickRef.current.time < 300) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      lastClickRef.current = null;
      
      // 브라우저 기본 더블클릭에 의한 텍스트 선택 해제 (줌을 의도했으므로)
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      
      handleDoubleClick(e.clientX, e.clientY);
      return;
    }

    lastClickRef.current = { time: now, x: e.clientX, y: e.clientY };

    // 3. 현재 텍스트가 선택되어 있다면 다른 단일 클릭 동작 무시
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      if (e.target === e.currentTarget) {
        handleCleanupSelection();
      }
      return;
    }

    // 4. 싱글 클릭 확정 시에만 cleanup 수행
    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null;
      if (e.target === e.currentTarget) {
        handleCleanupSelection();
      }
      if (tooltipPos) {
        setTooltipPos(null);
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

  // 휠/트랙패드 줌 종료 핸들러 (오염 위험 없음, ref.state 직접 사용)
  const handleZoomStop = (ref: any) => {
    setIsQuickZoomed(false);
    
    const libScale = ref.state.scale;
    const currentScale = stateRef.current.currentScale;
    
    if (Math.abs(libScale - 1) < 0.05) {
      transformRef.current?.resetTransform(0);
      return;
    }
    
    const targetScale = Math.min(Math.max(currentScale * libScale, 0.25), 8.0);
    applyZoomWithAnchor(targetScale, "custom");
  };

  // 핀치 줌 종료 핸들러 (오염된 ref.state 대신 lastGoodPinchStateRef 사용)
  const handlePinchStop = () => {
    setIsQuickZoomed(false);
    
    const lastGood = lastGoodPinchStateRef.current;
    lastGoodPinchStateRef.current = null;
    
    if (!lastGood) {
      transformRef.current?.resetTransform(0);
      return;
    }
    
    const libScale = lastGood.scale;
    const currentScale = stateRef.current.currentScale;
    
    if (Math.abs(libScale - 1) < 0.05) {
      transformRef.current?.resetTransform(0);
      return;
    }
    
    const targetScale = Math.min(Math.max(currentScale * libScale, 0.25), 8.0);
    
    const anchor = pinchCenterRef.current;
    pinchCenterRef.current = null;
    
    applyZoomWithAnchor(targetScale, "custom", anchor?.x, anchor?.y);
  };

  return (
    <TransformWrapper
      ref={transformRef}
      initialScale={1}
      minScale={0.25 / currentScale}
      maxScale={8.0 / currentScale}
      panning={{ 
        disabled: true, 
      }}
      wheel={{ wheelDisabled: true }}
      pinch={{ step: 5 }}
      doubleClick={{ disabled: true }}
      onTransform={(ref, state) => {
        if (scaleDisplayRef.current) {
          const { currentScale } = stateRef.current;
          const perceived = currentScale * state.scale;
          const bounded = Math.min(Math.max(0.25, perceived), 8.0);
          scaleDisplayRef.current.innerText = `${Math.round(bounded * 100)}%`;
        }
      }}
      onPinch={(ref) => {
        // onPinch는 반드시 touches.length > 1 일 때만 호출됨 (라이브러리 소스 확인)
        const lastGood = lastGoodPinchStateRef.current;
        if (lastGood && pinchSpikeThreshold > 0) {
          const diff = Math.abs(ref.state.scale - lastGood.scale);
          // threshold가 10이면 10% (0.1)
          if (diff > lastGood.scale * (pinchSpikeThreshold / 100)) {
            // 튄 값 무시 (Drop frame)
            return;
          }
        }
        
        // 따라서 여기서 저장하는 state는 항상 2손가락 기준의 정상 값
        lastGoodPinchStateRef.current = {
          scale: ref.state.scale,
          positionX: ref.state.positionX,
          positionY: ref.state.positionY,
        };
      }}
      onZoomStop={handleZoomStop}
      onPinchStop={handlePinchStop}
    >
      {({ state }) => {
        const handleZoomIn = () => {
          setIsQuickZoomed(false);
          const { currentScale } = stateRef.current;
          const perceived = currentScale * state.scale;
          const currentPct = perceived * 100;
          let step = 5;
          if (currentPct >= 200) step = 20;
          else if (currentPct >= 130) step = 10;
          
          const nextPct = Math.ceil((currentPct + 1) / step) * step;
          const newScale = Math.min(nextPct / 100, 8.0);
          
          applyZoomWithAnchor(newScale, "custom");
        };

        const handleZoomOut = () => {
          setIsQuickZoomed(false);
          const { currentScale } = stateRef.current;
          const perceived = currentScale * state.scale;
          const currentPct = perceived * 100;
          let step = 5;
          if (currentPct > 200) step = 20;
          else if (currentPct > 130) step = 10;
          
          const nextPct = Math.floor((currentPct - 1) / step) * step;
          const newScale = Math.max(nextPct / 100, 0.25);
          
          applyZoomWithAnchor(newScale, "custom");
        };

        const handleFit = () => {
          setIsQuickZoomed(false);
          const fitScale = stateRef.current.fitScale;
          
          const transformComponent = document.querySelector('.react-transform-component') as HTMLElement;
          if (transformComponent) {
            transformComponent.style.transform = "";
          }
          
          flushSync(() => {
            setZoomMode("fit");
            setCustomScale(fitScale);
          });
          
          transformRef.current?.resetTransform(0);
          
          if (containerRef.current) {
            containerRef.current.scrollLeft = 0;
            // scrollTop 유지 (단일보기는 0, 연속보기는 그대로)
          }
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
                <span 
                  ref={scaleDisplayRef} 
                  onClick={() => setShowThresholdModal(true)}
                  className="text-ui-label-sm text-on-surface w-10 text-center whitespace-nowrap cursor-pointer hover:bg-surface-variant rounded transition-colors"
                  title="핀치 줌 보정 수치 설정"
                >
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
        className={`flex-1 bg-surface-dim relative ${zoomMode === "fit" ? "overflow-y-auto overflow-x-hidden" : "overflow-auto"}`}
        onClick={handleContainerClick}
        onTouchMove={(e) => {
          if (e.touches.length === 2) {
            pinchCenterRef.current = {
              x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
              y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };
          }
        }}
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
            wrapperStyle={{ width: "100%", height: "auto", overflow: "visible", touchAction: zoomMode === "fit" ? "pan-y" : "auto", userSelect: "text" }} 
            contentStyle={{ minWidth: "100%", width: "auto", display: "flex", flexDirection: "column", alignItems: "flex-start", userSelect: "text" }}
          >
            <div 
              ref={pdfWrapperRef}
              onMouseDown={(e) => e.stopPropagation()} 
              onTouchStart={(e) => { if (e.touches.length === 1) e.stopPropagation(); }}
              onTouchMove={(e) => { if (e.touches.length === 1) e.stopPropagation(); }}
              className="w-full flex flex-col items-start p-4"
            >
              <Document
                file={fileData}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<Loader2 size={40} className="animate-spin text-primary m-10" />}
                error={<div className="p-4 text-error">문서를 렌더링할 수 없습니다.</div>}
                className="w-full flex flex-col items-start pdf-document"
              >
                {viewMode === "single" ? (
                  <div id={`page-${pageNumber}`} className="shadow-2xl bg-white transition-transform origin-top mx-auto w-max">
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
        {/* 핀치 줌 보정 수치 모달 */}
        {showThresholdModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-surface-container rounded-xl p-6 w-80 shadow-xl border border-outline-variant">
              <h3 className="text-ui-title-md text-on-surface mb-2">핀치 줌 보정 수치</h3>
              <p className="text-ui-body-sm text-on-surface-variant mb-4">
                값이 작을수록 줌이 튀는 현상에 민감하게 반응하여 무시합니다. (기본값: 10%)
              </p>
              <div className="flex items-center gap-3 mb-6">
                <input 
                  type="range" 
                  min="1" max="50" step="1"
                  value={pinchSpikeThreshold}
                  onChange={(e) => setPinchSpikeThreshold(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-ui-label-md text-primary w-8 text-right">{pinchSpikeThreshold}%</span>
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setPinchSpikeThreshold(10)}
                  className="px-4 py-2 text-ui-label-md text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors"
                >
                  초기화
                </button>
                <button 
                  onClick={() => setShowThresholdModal(false)}
                  className="px-4 py-2 text-ui-label-md text-on-primary bg-primary rounded-lg shadow-sm hover:bg-primary-hover transition-colors"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    )}}
    </TransformWrapper>
  );
}
