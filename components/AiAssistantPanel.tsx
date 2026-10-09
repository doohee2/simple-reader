"use client";

import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "@/store/useStore";
import { useMetadataSync } from "@/hooks/useMetadataSync";
import { useLiveQuery } from "dexie-react-hooks";
import db from "@/lib/db";
import { fetchWithSessionRetry } from "@/lib/fetchWithSessionRetry";

interface AiAssistantPanelProps {
  forceTab?: "ai" | "memo";
}

export default function AiAssistantPanel({ forceTab }: AiAssistantPanelProps = {}) {
  const [activeTab, setActiveTab] = useState<"ai" | "memo">("ai");
  const [sortOrder, setSortOrder] = useState<"time" | "page">("time");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (forceTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(forceTab);
    }
  }, [forceTab]);

  const { selectedFileId, selectedText, setSelectedText, currentPage, actionIntent, clearActionIntent, setTargetPage, clearSelectedText } = useStore();
  
  const [selectedModel, setSelectedModel] = useState("gemini-flash-lite-latest");
  const [customPrompt, setCustomPrompt] = useState("설명 없이 번역한 결과만");
  const [translationResult, setTranslationResult] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { metadataList, trashList, saveMetadata, updateMetadata, deleteMetadata, restoreMetadata, manualSync, isSyncing } = useMetadataSync(selectedFileId);
  const [isViewingTrash, setIsViewingTrash] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const [isAddingMemo, setIsAddingMemo] = useState(false);
  const [newMemoContent, setNewMemoContent] = useState("");

  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const aiHistoryList = useLiveQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => selectedFileId ? db.aiHistory.where("fileId").equals(selectedFileId).reverse().sortBy("createdAt") : Promise.resolve([] as any[]),
    [selectedFileId]
  ) || [];

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [selectedText, adjustTextareaHeight]);

  const handleTranslate = useCallback(async (mode: "translate" | "summary" = "translate") => {
    if (!selectedText) return;
    
    setIsTranslating(true);
    setTranslationResult("");
    setError(null);

    try {
      const res = await fetchWithSessionRetry("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          text: selectedText, 
          mode, 
          customPrompt: customPrompt.trim(),
          model: selectedModel
        }),
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
      let fullResult = "";
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          fullResult += chunk;
          setTranslationResult((prev) => prev + chunk);
        }
      }

      if (selectedFileId && fullResult.trim()) {
        await db.aiHistory.add({
          id: crypto.randomUUID(),
          fileId: selectedFileId,
          type: mode,
          selectedText,
          result: fullResult.trim(),
          createdAt: new Date().toISOString(),
          page: currentPage
        });
        
        const count = await db.aiHistory.where("fileId").equals(selectedFileId).count();
        if (count > 50) {
          const oldItems = await db.aiHistory.where("fileId").equals(selectedFileId).sortBy("createdAt");
          const itemsToDelete = oldItems.slice(0, count - 50).map(item => item.id);
          await db.aiHistory.bulkDelete(itemsToDelete);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "번역 중 오류가 발생했습니다.");
    } finally {
      setIsTranslating(false);
    }
  }, [selectedText, customPrompt, selectedModel, selectedFileId, currentPage]);

  // actionIntent 감지 (툴팁에서 액션 발생 시)
  useEffect(() => {
    if (actionIntent === "translate") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab("ai");
      clearActionIntent();
      handleTranslate("translate");
    } else if (actionIntent === "memo") {
       
      setActiveTab("memo");
       
      setIsAddingMemo(true);
       
      setNewMemoContent("");
      clearActionIntent();
    }
  }, [actionIntent, clearActionIntent, handleTranslate]);

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
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
        {activeTab === "ai" && (
          isViewingHistory ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setIsViewingHistory(false)} className="p-1 hover:bg-surface-variant rounded-full text-on-surface transition-colors flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <span className="text-title-sm font-bold text-on-surface">AI 내역 조회</span>
              </div>
              {aiHistoryList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">history</span>
                  <p className="text-sm">저장된 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {aiHistoryList.map(history => (
                    <div 
                      key={history.id} 
                      onClick={() => {
                        setSelectedText(history.selectedText, history.page);
                        setTranslationResult(history.result);
                        setIsViewingHistory(false);
                      }}
                      className="flex flex-col gap-2 p-3 bg-surface border border-outline-variant rounded-lg hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all shadow-sm"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold bg-surface-variant text-on-surface-variant px-1.5 py-0.5 rounded">
                          {history.type === 'translate' ? '번역' : '요약'}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/70">
                          {new Date(history.createdAt).toLocaleString(undefined, {
                            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface line-clamp-2 leading-relaxed">{history.selectedText}</p>
                      <div className="h-px w-full bg-outline-variant/50 my-1" />
                      <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">{history.result}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Source Quote */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsViewingHistory(true)}
                      className="p-1 flex items-center justify-center hover:bg-surface-variant rounded-full text-on-surface-variant hover:text-primary transition-colors -ml-1"
                      title="AI 내역 조회"
                    >
                      <span className="material-symbols-outlined text-[16px]">history</span>
                    </button>
                    <span className="text-ui-label-sm text-on-surface-variant uppercase tracking-wider">선택된 문장</span>
                    {selectedText && (
                    <div className="flex gap-1 ml-1">
                      <button 
                        onClick={() => handleTranslate("translate")}
                        disabled={isTranslating}
                        className="flex items-center gap-1 bg-secondary text-on-secondary px-2 py-1 rounded text-[11px] font-bold hover:bg-[#00a572] transition-colors shadow-sm disabled:opacity-50"
                      >
                        {isTranslating ? <Loader2 size={12} className="animate-spin" /> : <span className="material-symbols-outlined text-[12px]">translate</span>}
                        한국어로 번역
                      </button>
                      <button 
                        onClick={() => handleTranslate("summary")}
                        disabled={isTranslating}
                        className="flex items-center gap-1 bg-surface-variant text-on-surface px-2 py-1 rounded text-[11px] font-bold hover:bg-surface-bright transition-colors shadow-sm disabled:opacity-50"
                      >
                        요약
                      </button>
                    </div>
                  )}
                </div>
                {selectedText && (
                  <div className="flex items-center gap-2">
                    <span className="text-primary text-[10px] bg-primary/10 px-1.5 py-0.5 rounded">
                      Page {currentPage}
                    </span>
                    <button 
                      onClick={clearSelectedText}
                      className="p-1 flex items-center justify-center hover:bg-surface-variant rounded-full text-on-surface-variant hover:text-error transition-colors -mr-1"
                      title="선택 영역 취소"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="bg-surface-container-low border-l-2 border-outline-variant p-3 rounded-r-lg min-h-[60px] flex">
                <textarea
                  ref={textareaRef}
                  value={selectedText}
                  onChange={(e) => {
                    const text = e.target.value;
                    if (text) {
                      setSelectedText(text, currentPage);
                    } else {
                      clearSelectedText();
                    }
                  }}
                  placeholder="PDF에서 텍스트를 드래그하거나 이곳에 직접 입력해 주세요."
                  className="w-full bg-transparent border-none resize-none overflow-y-auto min-h-[60px] font-ui-body text-sm leading-relaxed break-all whitespace-pre-wrap text-on-surface focus:outline-none placeholder:text-ui-body placeholder:text-on-surface-variant/70 custom-scrollbar"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
              </div>
            </div>

            {/* AI Result Box */}
            {(translationResult || isTranslating || error) && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col gap-3 relative mt-1 shadow-[inset_0_0_20px_rgba(208,188,255,0.05)]">
                {(!translationResult || isTranslating) && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[14px]">auto_awesome</span>
                    <span className="text-ui-label-bold text-primary text-xs">제미나이 AI</span>
                  </div>
                )}
                
                {error ? (
                  <p className="text-error text-sm">{error}</p>
                ) : (
                  <p className={`font-ui-body text-sm text-on-surface leading-relaxed break-keep whitespace-pre-wrap ${isTranslating ? "streaming-cursor" : ""}`}>
                    {translationResult}
                  </p>
                )}

                <div className="w-full h-px bg-outline-variant/30 my-1"></div>
                <button 
                  onClick={handleSaveMemo}
                  disabled={isTranslating || !translationResult || !!error}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 border border-outline-variant rounded hover:bg-surface-variant text-on-surface transition-colors text-xs font-bold disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  메모로 저장
                </button>
              </div>
            )}

            {/* Custom Prompt & Model Selection */}
            <div className="flex flex-col gap-2 mt-0">
              <div className="flex gap-2">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-surface border border-outline-variant rounded-lg px-2 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm w-[40%]"
                  disabled={isTranslating}
                >
                  <option value="gemini-flash-lite-latest">gemini-flash-lite-latest</option>
                  <option value="gemini-flash-latest">gemini-flash-latest</option>
                  <option value="gemini-pro-latest">gemini-pro-latest</option>
                </select>
                <input
                  type="text"
                  placeholder="추가 요청사항 (예: 경어체로 번역, 설명 생략)"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && selectedText && !isTranslating) {
                      handleTranslate("translate");
                    }
                  }}
                  className="w-[60%] bg-surface border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                  disabled={!selectedText || isTranslating}
                />
              </div>
            </div>
            </>
          )
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
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsViewingTrash(!isViewingTrash)}
                  className={`p-2 border border-outline-variant rounded-lg transition-colors flex items-center justify-center ${isViewingTrash ? 'bg-error/10 text-error border-error/50' : 'text-on-surface-variant hover:bg-surface-variant'}`}
                  title={isViewingTrash ? "이전 목록으로 돌아가기" : "휴지통"}
                >
                  <span className="material-symbols-outlined text-[16px]">{isViewingTrash ? 'arrow_back' : 'delete'}</span>
                </button>
                <button 
                  onClick={() => { setIsAddingMemo(true); setIsViewingTrash(false); }}
                  className="flex-1 py-2 border border-dashed border-outline-variant rounded-lg text-on-surface-variant hover:bg-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  새 메모 작성하기
                </button>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "time" | "page")}
                  className="bg-surface border border-outline-variant rounded-lg px-2 py-2 text-xs text-on-surface-variant focus:outline-none focus:border-primary transition-all shadow-sm shrink-0 outline-none"
                >
                  <option value="time">최신순</option>
                  <option value="page">페이지순</option>
                </select>
              </div>
            )}

            {(isViewingTrash ? trashList : metadataList).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-on-surface-variant">
                <p>{isViewingTrash ? "휴지통이 비어있습니다." : "저장된 메모나 책갈피가 없습니다."}</p>
              </div>
            ) : (
              [...(isViewingTrash ? trashList : metadataList)].sort((a, b) => {
                if (sortOrder === "page") {
                  if (a.page === b.page) return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                  return a.page - b.page;
                }
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
              }).map((meta) => (
                <div 
                  key={meta.id} 
                  className="bg-surface-container border border-outline-variant rounded-xl p-4 flex flex-col gap-3 group relative hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setTargetPage(meta.page);
                    if (meta.selectedText) {
                      setSelectedText(meta.selectedText, meta.page);
                    } else if (meta.type === "memo") {
                      setSelectedText(meta.content, meta.page);
                    }
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-primary text-[10px] bg-primary/10 px-1.5 py-0.5 rounded font-bold">
                        {meta.type === "memo" ? "MEMO" : "BOOKMARK"}
                      </span>
                      <span className="text-on-surface-variant text-xs">Page {meta.page}</span>
                      {meta.isUnsynced && (
                        <span className="text-[10px] text-secondary flex items-center gap-0.5 ml-1" title="동기화 대기중 (로컬에만 저장됨)">
                          <span className="material-symbols-outlined text-[14px]">cloud_sync</span>
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {isViewingTrash ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); restoreMetadata(meta.id); }}
                          className="text-on-surface-variant hover:text-[#00a572] p-1 flex items-center justify-center"
                          title="복구하기"
                        >
                          <span className="material-symbols-outlined text-[16px]">restore_from_trash</span>
                        </button>
                      ) : (
                        <>
                          {editingId !== meta.id && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleStartEdit(meta.id, meta.content); }}
                              className="text-on-surface-variant hover:text-primary p-1 flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteMetadata(meta.id); }}
                            className="text-on-surface-variant hover:text-error p-1 flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </>
                      )}
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
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface resize-none focus:outline-none focus:border-primary"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }} className="p-1 flex items-center justify-center text-on-surface-variant hover:text-error bg-surface-variant rounded">
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleSaveEdit(meta.id); }} className="p-1 flex items-center justify-center text-primary bg-primary/10 hover:bg-primary/20 rounded">
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

            {/* Sync Button Area */}
            <div className="mt-4 border-t border-outline-variant pt-6 pb-2">
              <button 
                onClick={() => manualSync()}
                disabled={isSyncing || (selectedFileId?.startsWith('local-') ?? false)}
                className="w-full py-2.5 flex items-center justify-center gap-2 bg-surface-container border border-outline-variant rounded-xl text-on-surface hover:bg-surface-variant hover:text-primary transition-all disabled:opacity-50 font-ui-label-bold shadow-sm"
              >
                <span className={`material-symbols-outlined text-[18px] ${isSyncing ? "animate-spin" : ""}`}>
                  {selectedFileId?.startsWith('local-') ? "cloud_off" : "sync"}
                </span>
                {isSyncing ? "동기화 중..." : "서버와 즉시 동기화"}
              </button>
              <p className="text-center text-[10px] text-on-surface-variant mt-2">
                {selectedFileId?.startsWith('local-') 
                  ? "로컬 전용 파일의 메모, 책갈피는 동기화되지 않습니다."
                  : "로컬에만 있는 메모는 서버로, 서버에만 있는 메모는 로컬로 가져옵니다."}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
