"use client";

import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useMetadataSync } from "@/hooks/useMetadataSync";

interface AiAssistantPanelProps {
  forceTab?: "ai" | "memo";
}

export default function AiAssistantPanel({ forceTab }: AiAssistantPanelProps = {}) {
  const [activeTab, setActiveTab] = useState<"ai" | "memo">("ai");

  useEffect(() => {
    if (forceTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(forceTab);
    }
  }, [forceTab]);

  const { selectedFileId, selectedText, currentPage, actionIntent, clearActionIntent } = useStore();
  
  const [translationResult, setTranslationResult] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { metadataList, saveMetadata, updateMetadata, deleteMetadata } = useMetadataSync(selectedFileId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const [isAddingMemo, setIsAddingMemo] = useState(false);
  const [newMemoContent, setNewMemoContent] = useState("");

  // actionIntent 감지 (툴팁에서 액션 발생 시)
  useEffect(() => {
    if (actionIntent === "translate") {
      setActiveTab("ai");
      clearActionIntent();
      handleTranslate("translate");
    } else if (actionIntent === "memo") {
      setActiveTab("memo");
      setIsAddingMemo(true);
      setNewMemoContent("");
      clearActionIntent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionIntent]);

  const handleStartEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditContent(content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async (id: string) => {
    if (editContent.trim()) {
      await updateMetadata(id, editContent);
    }
    setEditingId(null);
    setEditContent("");
  };

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "번역 중 오류가 발생했습니다.");
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
                    &quot;{selectedText}&quot;
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
                {isTranslating ? <Loader2 size={16} className="animate-spin" /> : <span className="material-symbols-outlined text-[16px]">translate</span>}
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
                  <span className="material-symbols-outlined text-primary text-[16px]">auto_awesome</span>
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
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  메모로 저장
                </button>
              </div>
            )}
          </>
        )}
        
        {activeTab === "memo" && (
          <div className="flex flex-col gap-4">
            {/* 새 메모 작성 UI */}
            {isAddingMemo ? (
              <div className="bg-surface-container border border-primary/50 rounded-xl p-4 flex flex-col gap-3 shadow-md">
                <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-primary text-[10px] bg-primary/10 px-1.5 py-0.5 rounded font-bold">새 메모</span>
                    <span className="text-on-surface-variant text-xs">Page {currentPage}</span>
                  </div>
                </div>
                {selectedText && (
                  <div className="border-l-2 border-outline-variant pl-3">
                    <p className="text-sm text-on-surface-variant italic line-clamp-2">
                      &quot;{selectedText}&quot;
                    </p>
                  </div>
                )}
                <textarea
                  value={newMemoContent}
                  onChange={(e) => setNewMemoContent(e.target.value)}
                  placeholder="메모 내용을 입력하세요..."
                  className="w-full bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface resize-none focus:outline-none focus:border-primary"
                  rows={3}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsAddingMemo(false)} className="px-3 py-1.5 text-sm text-on-surface-variant hover:text-error hover:bg-surface-variant rounded transition-colors">
                    취소
                  </button>
                  <button 
                    onClick={async () => {
                      if (newMemoContent.trim() || selectedText) {
                        await saveMetadata(currentPage, "memo", selectedText, newMemoContent.trim());
                      }
                      setIsAddingMemo(false);
                      setNewMemoContent("");
                    }} 
                    className="px-3 py-1.5 text-sm bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded transition-colors font-ui-label-bold"
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsAddingMemo(true)}
                className="w-full py-3 border border-dashed border-outline-variant rounded-xl text-on-surface-variant hover:bg-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-2 font-ui-label-bold"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                새 메모 작성하기
              </button>
            )}

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
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingId !== meta.id && (
                        <button 
                          onClick={() => handleStartEdit(meta.id, meta.content)}
                          className="text-on-surface-variant hover:text-primary p-1 flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      )}
                      <button 
                        onClick={() => deleteMetadata(meta.id)}
                        className="text-on-surface-variant hover:text-error p-1 flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                  
                  {meta.selectedText && (
                    <div className="border-l-2 border-outline-variant pl-3">
                      <p className="text-sm text-on-surface-variant italic line-clamp-2">
                        &quot;{meta.selectedText}&quot;
                      </p>
                    </div>
                  )}
                  
                  {editingId === meta.id ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface resize-none focus:outline-none focus:border-primary"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={handleCancelEdit} className="p-1 flex items-center justify-center text-on-surface-variant hover:text-error bg-surface-variant rounded">
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                        <button onClick={() => handleSaveEdit(meta.id)} className="p-1 flex items-center justify-center text-primary bg-primary/10 hover:bg-primary/20 rounded">
                          <span className="material-symbols-outlined text-[18px]">check</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface font-medium leading-relaxed whitespace-pre-wrap">
                      {meta.content}
                    </p>
                  )}
                  
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
