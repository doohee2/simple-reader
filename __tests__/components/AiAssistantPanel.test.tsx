import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiAssistantPanel from '@/components/AiAssistantPanel';
import { useStore } from '@/store/useStore';
import { useMetadataSync } from '@/hooks/useMetadataSync';

jest.mock('@/store/useStore', () => ({
  useStore: jest.fn(),
}));

jest.mock('@/hooks/useMetadataSync', () => ({
  useMetadataSync: jest.fn(),
}));

describe('AiAssistantPanel Integration', () => {
  const mockSaveMetadata = jest.fn();
  const mockDeleteMetadata = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useStore as unknown as jest.Mock).mockReturnValue({
      selectedFileId: 'file-123',
      selectedText: '테스트 문장입니다.',
      currentPage: 2,
    });

    (useMetadataSync as jest.Mock).mockReturnValue({
      metadataList: [],
      saveMetadata: mockSaveMetadata,
      deleteMetadata: mockDeleteMetadata,
    });

    global.fetch = jest.fn();
  });

  it('should display selected text and page number', () => {
    render(<AiAssistantPanel />);
    expect(screen.getByText('"테스트 문장입니다."')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });

  it('should handle translate flow and save memo', async () => {
    // Mock fetch for streaming response
    const mockEncoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(mockEncoder.encode('번역'));
        controller.enqueue(mockEncoder.encode('된 문장'));
        controller.close();
      }
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: stream,
    });

    render(<AiAssistantPanel />);

    const translateBtn = screen.getByRole('button', { name: /한국어로 번역/i });
    fireEvent.click(translateBtn);

    // Wait for translation to complete
    await waitFor(() => {
      expect(screen.getByText('번역된 문장')).toBeInTheDocument();
    });

    // Save as memo
    const saveMemoBtn = screen.getByRole('button', { name: /메모로 저장/i });
    fireEvent.click(saveMemoBtn);

    await waitFor(() => {
      expect(mockSaveMetadata).toHaveBeenCalledWith(2, 'memo', '테스트 문장입니다.', '번역된 문장');
    });

    // Tab should switch to 'memo'
    await waitFor(() => {
      expect(screen.getByText('저장된 메모나 책갈피가 없습니다.')).toBeInTheDocument();
    });
  });
});
