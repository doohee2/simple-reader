"use client";

import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import AiAssistantPanel from "./AiAssistantPanel";

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-surface-container-lowest h-full text-on-surface-variant">
      PDF 뷰어 로딩 중...
    </div>
  ),
});

export default function Workspace() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
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

  return (
    <main className="flex-1 flex overflow-hidden w-full">
      <PanelGroup orientation={isMobile ? "vertical" : "horizontal"} id="workspace-layout">
        {/* Left Panel: Reader */}
        <Panel defaultSize={isMobile ? 50 : 70} minSize={20}>
          <PdfViewer />
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className={`bg-outline-variant/30 hover:bg-primary/50 active:bg-primary transition-colors z-30 relative flex items-center justify-center ${
          isMobile ? "h-2 w-full cursor-row-resize" : "w-2 h-full cursor-col-resize"
        }`}>
          <div className={`absolute ${isMobile ? 'left-1/2 -translate-x-1/2 h-1 w-8' : 'top-1/2 -translate-y-1/2 w-1 h-8'} rounded-full bg-outline-variant`}></div>
        </PanelResizeHandle>

        {/* Right Panel: AI & Metadata */}
        <Panel defaultSize={isMobile ? 50 : 30} minSize={20}>
          <div className={`w-full h-full border-outline-variant ${isMobile ? 'border-t' : 'border-l'}`}>
            <AiAssistantPanel />
          </div>
        </Panel>
      </PanelGroup>
    </main>
  );
}
