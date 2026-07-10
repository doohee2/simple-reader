import { renderHook, waitFor } from '@testing-library/react';
import { usePdfFile } from '@/hooks/usePdfFile';
import db from '@/lib/db';

// Mock Dexie DB
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    pdfCache: {
      get: jest.fn(),
      put: jest.fn(),
    }
  }
}));

// Mock global fetch
global.fetch = jest.fn();

describe('usePdfFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return cached data if available', async () => {
    const mockData = new ArrayBuffer(8);
    (db.pdfCache.get as jest.Mock).mockResolvedValue({ data: mockData });

    const { result } = renderHook(() => usePdfFile('file-123'));

    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.fileData).toBe(mockData);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should fetch from API if not cached and save to cache', async () => {
    const mockData = new ArrayBuffer(8);
    (db.pdfCache.get as jest.Mock).mockResolvedValue(null);
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockData),
    });

    const { result } = renderHook(() => usePdfFile('file-123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/drive/download?fileId=file-123');
    expect(db.pdfCache.put).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'file-123',
      data: mockData,
    }));
    expect(result.current.fileData).toBe(mockData);
  });

  it('should handle API fetch error', async () => {
    (db.pdfCache.get as jest.Mock).mockResolvedValue(null);
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
    });

    const { result } = renderHook(() => usePdfFile('file-123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('PDF 다운로드에 실패했습니다. (Google 로그인 및 권한을 확인하세요)');
    expect(result.current.fileData).toBeNull();
  });
});
