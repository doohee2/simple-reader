import { create } from 'zustand';

interface StoreState {
  selectedFileId: string | null;
  selectedFileName: string | null;
  setSelectedFile: (id: string, name: string) => void;
  
  // 텍스트 선택 관련 상태
  selectedText: string;
  currentPage: number;
  setSelectedText: (text: string, page: number) => void;
  clearSelectedText: () => void;
}

export const useStore = create<StoreState>((set) => ({
  selectedFileId: null,
  selectedFileName: null,
  setSelectedFile: (id, name) => set({ selectedFileId: id, selectedFileName: name }),
  
  selectedText: "",
  currentPage: 1,
  setSelectedText: (text, page) => set({ selectedText: text, currentPage: page }),
  clearSelectedText: () => set({ selectedText: "" }),
}));
