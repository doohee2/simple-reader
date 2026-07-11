import { act } from '@testing-library/react';
import { useStore } from '@/store/useStore';

describe('useStore', () => {
  beforeEach(() => {
    useStore.setState({
      selectedFileId: null,
      selectedFileName: null,
      selectedText: "",
      currentPage: 1,
    });
  });

  it('should set selected file', () => {
    act(() => {
      useStore.getState().setSelectedFile('file-123', 'test.pdf', null);
    });
    
    expect(useStore.getState().selectedFileId).toBe('file-123');
    expect(useStore.getState().selectedFileName).toBe('test.pdf');
  });

  it('should set selected text and page', () => {
    act(() => {
      useStore.getState().setSelectedText('Hello world', 5);
    });

    expect(useStore.getState().selectedText).toBe('Hello world');
    expect(useStore.getState().currentPage).toBe(5);
  });

  it('should clear selected text', () => {
    act(() => {
      useStore.getState().setSelectedText('Hello world', 5);
    });
    
    act(() => {
      useStore.getState().clearSelectedText();
    });

    expect(useStore.getState().selectedText).toBe('');
    expect(useStore.getState().currentPage).toBe(5);
  });
});
