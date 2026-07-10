"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import AiAssistantPanel from "./AiAssistantPanel";

export default function MobileBottomSheet() {
  const { bottomSheetTab, setBottomSheetTab } = useStore();
  
  // 높이 상태 (px 단위)
  const [height, setHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 닫힌 상태인지 여부
  const isOpen = bottomSheetTab !== "none";
  
  // 마우스/터치 시작 위치 및 초기 높이 저장
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // 최대/최소 높이 계산을 위한 창 크기
  const [windowHeight, setWindowHeight] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWindowHeight(window.innerHeight);
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 바텀 시트가 열릴 때 기본 높이 설정 (Peek 상태)
  useEffect(() => {
    if (isOpen && height === 0 && windowHeight > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeight(windowHeight * 0.4); // 기본 40% 높이
    } else if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeight(0); // 닫히면 높이 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, windowHeight]);

  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartHeight.current = height;
    document.body.style.userSelect = "none"; // 드래그 중 텍스트 선택 방지
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const deltaY = dragStartY.current - clientY;
    const newHeight = dragStartHeight.current + deltaY;
    
    // 최대 화면의 90%, 최소 100px로 제한
    const maxHeight = windowHeight * 0.9;
    if (newHeight > maxHeight) {
      setHeight(maxHeight);
    } else if (newHeight < 100) {
      // 100px보다 작아지면 닫기 의도로 간주할 수 있지만, move 중에는 일단 높이만 줄임
      setHeight(newHeight);
    } else {
      setHeight(newHeight);
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    document.body.style.userSelect = "";

    // 스냅(Snap) 로직: 특정 기준점 이하면 닫거나 기본 크기로
    const peekHeight = windowHeight * 0.4;
    const expandedHeight = windowHeight * 0.8;

    if (height < peekHeight * 0.5) {
      // 아주 낮게 내리면 닫기
      setBottomSheetTab("none");
    } else if (height > peekHeight && height < (peekHeight + expandedHeight) / 2) {
      // 어중간하게 올렸으면 Peek 높이로 스냅
      setHeight(peekHeight);
    } else if (height >= (peekHeight + expandedHeight) / 2) {
      // 많이 올렸으면 Expanded 높이로 스냅
      setHeight(expandedHeight);
    }
  };

  // 터치 이벤트
  const onTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientY);
  const onTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientY);
  const onTouchEnd = () => handleDragEnd();

  // 마우스 이벤트 (개발 환경 테스트용)
  const onMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientY);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientY);
    const handleMouseUp = () => handleDragEnd();

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  if (!isOpen) return null;

  return (
    <>
      {/* 백드롭 (선택적: 시트가 많이 올라갔을 때만 어둡게 하거나 투명하게 둘 수 있음) */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 md:hidden transition-opacity"
        style={{ opacity: height > windowHeight * 0.6 ? 1 : 0, pointerEvents: height > windowHeight * 0.6 ? 'auto' : 'none' }}
        onClick={() => setBottomSheetTab("none")}
      />
      
      {/* 바텀 시트 컨테이너 */}
      <div 
        ref={containerRef}
        className={`fixed bottom-[60px] left-0 right-0 bg-surface z-50 md:hidden rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.15)] border-t border-outline-variant flex flex-col overflow-hidden ${
          !isDragging ? "transition-[height] duration-300 ease-out" : ""
        }`}
        style={{ height: `${height}px` }}
      >
        {/* 드래그 핸들 영역 */}
        <div 
          className="w-full flex justify-center items-center h-8 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none bg-surface"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
        >
          <div className="w-12 h-1.5 bg-outline-variant rounded-full" />
        </div>
        
        {/* 콘텐츠 영역 (AiAssistantPanel 재사용) */}
        <div className="flex-1 overflow-hidden relative">
          <AiAssistantPanel forceTab={bottomSheetTab === "ai" ? "ai" : "memo"} />
        </div>
      </div>
    </>
  );
}
