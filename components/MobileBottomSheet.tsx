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

  // 바텀 시트가 열릴 때 기본 높이 설정 (마지막으로 저장된 위치 로드)
  useEffect(() => {
    if (isOpen && height === 0 && windowHeight > 0) {
      const savedRatio = localStorage.getItem("bottomSheetHeightRatio");
      const ratio = savedRatio ? parseFloat(savedRatio) : 0.4;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeight(windowHeight * Math.min(Math.max(ratio, 0.2), 0.9));
    } else if (!isOpen) {
       
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
    
    // 최대 화면의 90%, 최소 0px로 제한
    const maxHeight = windowHeight * 0.9;
    setHeight(Math.max(0, Math.min(newHeight, maxHeight)));
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    document.body.style.userSelect = "";

    // 스냅(Snap) 로직 대신, 사용자가 원하는 자유로운 높이를 영구 저장
    if (height < 100) {
      // 아주 낮게 내리면 닫기
      setBottomSheetTab("none");
    } else {
      // 드래그가 끝난 최종 높이를 비율로 저장 (기기 방향 전환 시에도 비율 유지)
      const ratio = height / windowHeight;
      localStorage.setItem("bottomSheetHeightRatio", ratio.toString());
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
