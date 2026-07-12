import { renderHook, waitFor, act } from '@testing-library/react';
import { usePdfFile } from '@/hooks/usePdfFile';
import db from '@/lib/db';
import { useStore } from '@/store/useStore';

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

jest.mock('next-auth/react', () => ({
  useSession: jest.fn().mockReturnValue({ data: { user: { id: 'user-123' }, accessToken: 'token-123' } }),
}));

jest.mock('@/store/useStore', () => ({
  useStore: {
    getState: jest.fn().mockReturnValue({
      selectedFileSize: 1000,
      selectedFileName: 'test.pdf',
      setSelectedFile: jest.fn(),
    }),
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

    await waitFor(() => {
      expect(result.current.downloadState).toBe('success');
    });

    expect(result.current.fileData).toBe(mockData);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should fetch from API via startDirectDownload if not cached and save to cache', async () => {
    const mockData = new Uint8Array(8);
    (db.pdfCache.get as jest.Mock).mockResolvedValue(null);
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: { get: () => '8' },
      body: {
        getReader: () => {
          let done = false;
          return {
            read: () => {
              if (!done) {
                done = true;
                return Promise.resolve({ done: false, value: mockData });
              }
              return Promise.resolve({ done: true });
            }
          };
        }
      }
    });

    const { result } = renderHook(() => usePdfFile('file-123'));

    await waitFor(() => {
      expect(result.current.downloadState).toBe('confirm');
    });

    await act(async () => {
      await result.current.startDirectDownload();
    });

    await waitFor(() => {
      expect(result.current.downloadState).toBe('success');
    });

    expect(global.fetch).toHaveBeenCalledWith('https://www.googleapis.com/drive/v3/files/file-123?alt=media', expect.any(Object));
    expect(db.pdfCache.put).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'file-123',
      fileName: 'test.pdf',
    }));
    expect(result.current.fileData).toBeInstanceOf(ArrayBuffer);
  });

  it('should handle API fetch error and fallback to proxy_confirm', async () => {
    (db.pdfCache.get as jest.Mock).mockResolvedValue(null);
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403
    });

    const { result } = renderHook(() => usePdfFile('file-123'));

    await waitFor(() => {
      expect(result.current.downloadState).toBe('confirm');
    });

    await act(async () => {
      await result.current.startDirectDownload();
    });

    await waitFor(() => {
      expect(result.current.downloadState).toBe('proxy_confirm');
    });

    expect(result.current.error).toBe('직접 다운로드에 실패했습니다. (CORS, 만료된 토큰 또는 권한 문제일 수 있습니다)');
    expect(result.current.fileData).toBeNull();
  });
});
