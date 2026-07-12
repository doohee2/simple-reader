import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import PdfViewer from '@/components/PdfViewer';

class MockIntersectionObserver {
  constructor(callback: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _cb = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver as any;
import { useStore } from '@/store/useStore';
import { usePdfFile } from '@/hooks/usePdfFile';
import { useMetadataSync } from '@/hooks/useMetadataSync';

jest.mock('@/store/useStore', () => ({
  useStore: jest.fn(),
}));

jest.mock('@/hooks/usePdfFile', () => ({
  usePdfFile: jest.fn(),
}));

jest.mock('@/hooks/useMetadataSync', () => ({
  useMetadataSync: jest.fn(),
}));

jest.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess }: any) => {
    setTimeout(() => onLoadSuccess({ numPages: 5 }), 0);
    return <div>{children}</div>;
  },
  Page: () => <div data-testid="pdf-page">Page Content</div>,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
}));

describe('PdfViewer Integration', () => {
  const mockClearSelectedText = jest.fn();
  const mockSetSelectedText = jest.fn();
  const mockSetActionIntent = jest.fn();
  const mockToggleViewMode = jest.fn();
  
  const mockSetTargetPage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useStore as unknown as jest.Mock).mockReturnValue({
      selectedFileId: 'file-123',
      selectedText: '',
      setSelectedText: mockSetSelectedText,
      clearSelectedText: mockClearSelectedText,
      setActionIntent: mockSetActionIntent,
      viewMode: 'single',
      toggleViewMode: mockToggleViewMode,
      targetPage: null,
      setTargetPage: mockSetTargetPage,
    });

    (usePdfFile as jest.Mock).mockReturnValue({
      fileData: new ArrayBuffer(8),
      downloadState: 'success',
      isLoading: false,
      error: null,
    });

    (useMetadataSync as jest.Mock).mockReturnValue({
      metadataList: [],
      saveMetadata: jest.fn(),
      deleteMetadata: jest.fn(),
    });

    const mockRemoveAllRanges = jest.fn();
    window.getSelection = jest.fn().mockReturnValue({
      removeAllRanges: mockRemoveAllRanges,
      toString: () => '선택된 텍스트',
    });
  });

  it('should clear selection on page change', async () => {
    const { findByText } = render(<PdfViewer />);
    
    // Wait for Document onLoadSuccess to trigger numPages update
    const pageText = await findByText('1 / 5');
    expect(pageText).toBeInTheDocument();

    const nextPageBtn = screen.getByText('chevron_right').closest('button')!;
    fireEvent.click(nextPageBtn);

    expect(window.getSelection()?.removeAllRanges).toHaveBeenCalled();
    expect(mockClearSelectedText).toHaveBeenCalled();
    
    const newPageText = await findByText('2 / 5');
    expect(newPageText).toBeInTheDocument();
  });
});
