import { render, screen, fireEvent } from '@testing-library/react';
import PdfViewer from '@/components/PdfViewer';
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
  
  beforeEach(() => {
    jest.clearAllMocks();

    (useStore as unknown as jest.Mock).mockReturnValue({
      selectedFileId: 'file-123',
      setSelectedText: mockSetSelectedText,
      clearSelectedText: mockClearSelectedText,
    });

    (usePdfFile as jest.Mock).mockReturnValue({
      fileData: new ArrayBuffer(8),
      isLoading: false,
      error: null,
    });

    (useMetadataSync as jest.Mock).mockReturnValue({
      saveMetadata: jest.fn(),
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

    const buttons = screen.getAllByRole('button');
    const nextPageBtn = buttons[1]; // ChevronRight
    
    fireEvent.click(nextPageBtn);

    expect(window.getSelection()?.removeAllRanges).toHaveBeenCalled();
    expect(mockClearSelectedText).toHaveBeenCalled();
    
    const newPageText = await findByText('2 / 5');
    expect(newPageText).toBeInTheDocument();
  });
});
