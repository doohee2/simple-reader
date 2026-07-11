import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreState {
  selectedFileId: string | null;
  selectedFileName: string | null;
  selectedFileSize: number | null;
  setSelectedFile: (id: string | null, name: string | null, size: number | null) => void;
  
  // 텍스트 선택 관련 상태
  selectedText: string;
  currentPage: number;
  setSelectedText: (text: string, page: number) => void;
  clearSelectedText: () => void;

  targetPage: number | null;
  setTargetPage: (page: number | null) => void;

  // 테마 상태
  theme: "dark" | "light";
  toggleTheme: () => void;

  // 모바일 바텀 시트 상태
  bottomSheetTab: "ai" | "memo" | "none";
  setBottomSheetTab: (tab: "ai" | "memo" | "none") => void;

  // 구글 드라이브 피커 모달 상태
  isDrivePickerOpen: boolean;
  setIsDrivePickerOpen: (isOpen: boolean) => void;

  // 내 서재 모달 상태
  isStorageManagerOpen: boolean;
  setIsStorageManagerOpen: (isOpen: boolean) => void;

  // PDF 뷰 모드
  viewMode: "single" | "continuous";
  toggleViewMode: () => void;

  // 플로팅 툴팁 액션 의도 전달용
  actionIntent: "translate" | "summary" | "memo" | null;
  setActionIntent: (intent: "translate" | "summary" | "memo" | null) => void;
  clearActionIntent: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
  selectedFileId: null,
  selectedFileName: null,
  selectedFileSize: null,
  setSelectedFile: (id, name, size) => set({ selectedFileId: id, selectedFileName: name, selectedFileSize: size }),
  
  selectedText: "",
  currentPage: 1,
  setSelectedText: (text, page) => set({ selectedText: text, currentPage: page }),
  clearSelectedText: () => set({ selectedText: "" }),

  targetPage: null,
  setTargetPage: (page) => set({ targetPage: page }),

  theme: "dark",
  toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),

  bottomSheetTab: "none",
  setBottomSheetTab: (tab) => set({ bottomSheetTab: tab }),

  isDrivePickerOpen: false,
  setIsDrivePickerOpen: (isOpen) => set({ isDrivePickerOpen: isOpen }),

  isStorageManagerOpen: false,
  setIsStorageManagerOpen: (isOpen) => set({ isStorageManagerOpen: isOpen }),

  viewMode: "single",
  toggleViewMode: () => set((state) => ({ viewMode: state.viewMode === "single" ? "continuous" : "single" })),

  actionIntent: null,
  setActionIntent: (intent) => set({ actionIntent: intent }),
  clearActionIntent: () => set({ actionIntent: null }),
    }),
    {
      name: 'simple-reader-storage',
      partialize: (state) => ({ 
        theme: state.theme,
        selectedFileId: state.selectedFileId,
        selectedFileName: state.selectedFileName,
        selectedFileSize: state.selectedFileSize,
        viewMode: state.viewMode
      }),
    }
  )
);
