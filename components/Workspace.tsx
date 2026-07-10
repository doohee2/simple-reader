"use client";

import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AiAssistantPanel from "./AiAssistantPanel";
import MobileBottomSheet from "./MobileBottomSheet";
import BottomNavBar from "./BottomNavBar";

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-surface-container-lowest h-full text-on-surface-variant">
      PDF 뷰어 로딩 중...
    </div>
  ),
});

export default function Workspace() {
  const { status } = useSession();
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Hydration mismatch 방지
  if (!mounted) {
    return <main className="flex-1 flex overflow-hidden w-full bg-surface" />;
  }

  // 로그인 상태 확인
  if (status === "loading") {
    return (
      <main className="flex-1 flex items-center justify-center bg-surface-container-lowest w-full h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="flex-1 flex items-center justify-center bg-surface-container-lowest h-full w-full">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
          <span className="material-symbols-outlined text-6xl text-primary/50">account_circle</span>
          <h2 className="text-headline-md text-on-surface">로그인이 필요합니다</h2>
          <p className="text-ui-body text-on-surface-variant">
            상단의 <strong>Google 로그인</strong> 버튼을 눌러 이북 리더기를 시작해보세요. 
            구글 드라이브와 자동으로 연동됩니다.
          </p>
        </div>
      </main>
    );
  }

  if (isMobile) {
    return (
      <main className="flex-1 flex flex-col w-full h-full relative overflow-hidden bg-surface pb-[60px]">
        {/* 모바일 뷰어: 전체 화면 */}
        <PdfViewer />
        
        {/* 모바일 바텀 시트 */}
        <MobileBottomSheet />
        
        {/* 모바일 바텀 네비게이션바 */}
        <BottomNavBar />
      </main>
    );
  }

  // 데스크탑 레이아웃 (좌우 분할)
  return (
    <main className="flex-1 flex overflow-hidden w-full">
      <PanelGroup orientation="horizontal" id="workspace-layout">
        {/* Left Panel: Reader */}
        <Panel defaultSize={70} minSize={20}>
          <PdfViewer />
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-2 h-full cursor-col-resize bg-outline-variant/30 hover:bg-primary/50 active:bg-primary transition-colors z-30 relative flex items-center justify-center">
          <div className="absolute top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-outline-variant"></div>
        </PanelResizeHandle>

        {/* Right Panel: AI & Metadata */}
        <Panel defaultSize={30} minSize={20}>
          <div className="w-full h-full border-l border-outline-variant">
            <AiAssistantPanel />
          </div>
        </Panel>
      </PanelGroup>
    </main>
  );
}
