"use client";

import { Sparkles, MoreHorizontal, Save, Languages, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/store/useStore";
import { useMetadataSync } from "@/hooks/useMetadataSync";

export default function AiAssistantPanel() {
  const [activeTab, setActiveTab] = useState<"ai" | "memo">("ai");
  const { selectedFileId, selectedText, currentPage } = useStore();
  
  const [translationResult, setTranslationResult] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { metadataList, saveMetadata, deleteMetadata } = useMetadataSync(selectedFileId);

  const handleTranslate = async (mode: "translate" | "summary" = "translate") => {
    if (!selectedText) return;
    
    setIsTranslating(true);
    setTranslationResult("");
    setError(null);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: selectedText, mode }),
      });

      if (!res.ok) {
        throw new Error("API 요청에 실패했습니다.");
      }

      if (!res.body) {
        throw new Error("응답 본문이 없습니다.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setTranslationResult((prev) => prev + chunk);
        }
      }
    } catch (err: any) {
      setError(err.message || "번역 중 오류가 발생했습니다.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSaveMemo = async () => {
    if (!translationResult) return;
    await saveMetadata(currentPage, "memo", selectedText, translationResult);
    setActiveTab("memo"); // 저장 후 메모 탭으로 이동
  };

  return (
    <section className="w-full h-full bg-surface flex flex-col shrink-0">
      {/* Tabs */}
      <div className="flex border-b border-outline-variant px-2 pt-2 gap-4 flex-shrink-0">
        <button
          onClick={() => setActiveTab("ai")}
          className={`pb-3 px-2 text-ui-label-bold relative transition-colors ${
            activeTab === "ai"
              ? "text-primary border-b-2 border-primary"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          AI 번역·요약
        </button>
        <button
          onClick={() => setActiveTab("memo")}
          className={`pb-3 px-2 text-ui-label-bold relative transition-colors ${
            activeTab === "memo"
              ? "text-primary border-b-2 border-primary"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          메모·책갈피
          {metadataList.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center bg-primary/10 text-primary text-[10px] w-5 h-5 rounded-full">
              {metadataList.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
        {activeTab === "ai" && (
          <>
            {/* Source Quote */}
            <div className="flex flex-col gap-2">
              <span className="text-ui-label-sm text-on-surface-variant uppercase tracking-wider flex justify-between items-center">
                <span>선택된 문장</span>
                {selectedText && (
                  <span className="text-primary text-[10px] bg-primary/10 px-1.5 py-0.5 rounded">
                    Page {currentPage}
                  </span>
                )}
              </span>
              <div className="bg-surface-container-low border-l-2 border-outline-variant p-4 rounded-r-lg min-h-[60px] flex items-center">
                {selectedText ? (
                  <p className="font-reading-body text-reading-body text-on-surface italic text-sm">
                    "{selectedText}"
                  </p>
                ) : (
                  <p className="text-ui-body text-on-surface-variant italic text-sm">
                    좌측 PDF에서 텍스트를 드래그하여 선택해 주세요.
                  </p>
                )}
              </div>
            </div>

            {/* Action Area */}
            <div className="flex justify-between items-center">
              <button 
                onClick={() => handleTranslate("translate")}
                disabled={!selectedText || isTranslating}
                className="flex items-center gap-2 bg-secondary text-on-secondary px-4 py-2 rounded text-ui-label-bold hover:bg-[#00a572] transition-colors shadow-md disabled:opacity-50"
              >
                {isTranslating ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
                한국어로 번역
              </button>
              <button 
                onClick={() => handleTranslate("summary")}
                disabled={!selectedText || isTranslating}
                className="flex items-center gap-2 bg-surface-variant text-on-surface px-4 py-2 rounded text-ui-label-bold hover:bg-surface-bright transition-colors disabled:opacity-50"
              >
                요약하기
              </button>
            </div>

            {/* AI Result Box */}
            {(translationResult || isTranslating || error) && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex flex-col gap-4 relative mt-2 shadow-[inset_0_0_20px_rgba(208,188,255,0.05)]">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-primary" />
                  <span className="text-ui-label-bold text-primary">제미나이 AI</span>
                </div>
                
                {error ? (
                  <p className="text-error text-ui-body">{error}</p>
                ) : (
                  <p className={`font-ui-body text-ui-body text-on-surface leading-relaxed ${isTranslating ? "streaming-cursor" : ""}`}>
                    {translationResult}
                  </p>
                )}

                <div className="w-full h-px bg-outline-variant/30 my-2"></div>
                <button 
                  onClick={handleSaveMemo}
                  disabled={isTranslating || !translationResult || !!error}
                  className="flex items-center justify-center gap-2 w-full py-2 border border-outline-variant rounded hover:bg-surface-variant text-on-surface transition-colors text-ui-label-bold disabled:opacity-50"
                >
                  <Save size={16} />
                  메모로 저장
                </button>
              </div>
            )}
          </>
        )}
        
        {activeTab === "memo" && (
          <div className="flex flex-col gap-4">
            {metadataList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-on-surface-variant">
                <p>저장된 메모나 책갈피가 없습니다.</p>
              </div>
            ) : (
              metadataList.map((meta) => (
                <div key={meta.id} className="bg-surface-container border border-outline-variant rounded-xl p-4 flex flex-col gap-3 group relative hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-primary text-[10px] bg-primary/10 px-1.5 py-0.5 rounded font-bold">
                        {meta.type === "memo" ? "MEMO" : "BOOKMARK"}
                      </span>
                      <span className="text-on-surface-variant text-xs">Page {meta.page}</span>
                    </div>
                    <button 
                      onClick={() => deleteMetadata(meta.id)}
                      className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  {meta.selectedText && (
                    <div className="border-l-2 border-outline-variant pl-3">
                      <p className="text-sm text-on-surface-variant italic line-clamp-2">
                        "{meta.selectedText}"
                      </p>
                    </div>
                  )}
                  
                  <p className="text-sm text-on-surface font-medium leading-relaxed">
                    {meta.content}
                  </p>
                  
                  <span className="text-[10px] text-on-surface-variant self-end mt-1">
                    {new Date(meta.updatedAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
