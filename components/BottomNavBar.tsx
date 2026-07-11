"use client";

import { useStore } from "@/store/useStore";

export default function BottomNavBar() {
  const { 
    bottomSheetTab, 
    setBottomSheetTab, 
    setIsDrivePickerOpen, 
    setIsStorageManagerOpen, 
    selectedFileId, 
    setSelectedFile 
  } = useStore();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-surface border-t border-outline-variant flex items-center justify-around px-1 z-40 pb-safe">
      <button
        onClick={() => setBottomSheetTab("none")}
        className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
          bottomSheetTab === "none" ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: bottomSheetTab === "none" ? "'FILL' 1" : "'FILL' 0" }}>menu_book</span>
        <span className="text-[10px] font-ui-label-bold">읽기</span>
      </button>

      <button
        onClick={() => setBottomSheetTab("ai")}
        className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
          bottomSheetTab === "ai" ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: bottomSheetTab === "ai" ? "'FILL' 1" : "'FILL' 0" }}>auto_awesome</span>
        <span className="text-[10px] font-ui-label-bold">AI 도구</span>
      </button>

      <button
        onClick={() => setBottomSheetTab("memo")}
        className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
          bottomSheetTab === "memo" ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: bottomSheetTab === "memo" ? "'FILL' 1" : "'FILL' 0" }}>edit_note</span>
        <span className="text-[10px] font-ui-label-bold">메모</span>
      </button>

      <button
        onClick={() => {
          setBottomSheetTab("none");
          setIsStorageManagerOpen(true);
        }}
        className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <span className="material-symbols-outlined text-[24px]">local_library</span>
        <span className="text-[10px] font-ui-label-bold">내 서재</span>
      </button>

      {selectedFileId ? (
        <button
          onClick={() => {
            setBottomSheetTab("none");
            setSelectedFile(null, null);
          }}
          className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">close</span>
          <span className="text-[10px] font-ui-label-bold">파일 닫기</span>
        </button>
      ) : (
        <button
          onClick={() => {
            setBottomSheetTab("none");
            setIsDrivePickerOpen(true);
          }}
          className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">folder_open</span>
          <span className="text-[10px] font-ui-label-bold">드라이브</span>
        </button>
      )}
    </nav>
  );
}
