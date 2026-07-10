import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreState {
  selectedFileId: string | null;
  selectedFileName: string | null;
  setSelectedFile: (id: string | null, name: string | null) => void;
  
  // 텍스트 선택 관련 상태
  selectedText: string;
  currentPage: number;
  setSelectedText: (text: string, page: number) => void;
  clearSelectedText: () => void;

  // 테마 상태
  theme: "dark" | "light";
  toggleTheme: () => void;

  // 모바일 바텀 시트 상태
  bottomSheetTab: "ai" | "memo" | "none";
  setBottomSheetTab: (tab: "ai" | "memo" | "none") => void;

  // 구글 드라이브 피커 모달 상태
  isDrivePickerOpen: boolean;
  setIsDrivePickerOpen: (isOpen: boolean) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
  selectedFileId: null,
  selectedFileName: null,
  setSelectedFile: (id, name) => set({ selectedFileId: id, selectedFileName: name }),
  
  selectedText: "",
  currentPage: 1,
  setSelectedText: (text, page) => set({ selectedText: text, currentPage: page }),
  clearSelectedText: () => set({ selectedText: "" }),

  theme: "dark",
  toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),

  bottomSheetTab: "none",
  setBottomSheetTab: (tab) => set({ bottomSheetTab: tab }),

  isDrivePickerOpen: false,
  setIsDrivePickerOpen: (isOpen) => set({ isDrivePickerOpen: isOpen }),
    }),
    {
      name: 'simple-reader-storage',
      partialize: (state) => ({ 
        theme: state.theme,
        selectedFileId: state.selectedFileId,
        selectedFileName: state.selectedFileName
      }),
    }
  )
);
