"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import dynamic from "next/dynamic";
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
  return (
    <main className="flex-1 flex overflow-hidden w-full">
      <PanelGroup direction="horizontal" autoSaveId="workspace-layout">
        {/* Left Panel: Reader */}
        <Panel defaultSize={70} minSize={30}>
          <PdfViewer />
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-1 bg-outline-variant/30 hover:bg-primary/50 active:bg-primary transition-colors cursor-col-resize z-30 relative flex items-center justify-center">
          <div className="absolute top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-outline-variant"></div>
        </PanelResizeHandle>

        {/* Right Panel: AI & Metadata */}
        <Panel defaultSize={30} minSize={20} maxSize={50}>
          <div className="w-full h-full border-l border-outline-variant">
            <AiAssistantPanel />
          </div>
        </Panel>
      </PanelGroup>
    </main>
  );
}
