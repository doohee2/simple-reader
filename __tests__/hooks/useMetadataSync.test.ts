import { renderHook, waitFor, act } from '@testing-library/react';
import { useMetadataSync } from '@/hooks/useMetadataSync';
import db from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { useSession } from 'next-auth/react';

jest.mock('@/lib/db', () => {
  const mPdfMetadata = {
    where: jest.fn().mockReturnThis(),
    equals: jest.fn().mockReturnThis(),
    toArray: jest.fn().mockResolvedValue([]),
    bulkPut: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      pdfMetadata: mPdfMetadata
    }
  };
});

jest.mock('@/lib/supabase', () => {
  const mEq = jest.fn().mockReturnThis();
  const mSelect = jest.fn().mockReturnThis();
  const mUpsert = jest.fn().mockResolvedValue({ error: null });
  const mDelete = jest.fn().mockReturnThis();

  return {
    __esModule: true,
    supabase: {
      from: jest.fn(() => ({
        select: mSelect,
        eq: mEq,
        upsert: mUpsert,
        delete: mDelete,
      })),
    },
  };
});

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

describe('useMetadataSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: 'user-123' } },
    });
  });

  it('should load local metadata on mount', async () => {
    const mockLocalData = [{ id: '1', fileId: 'file-123', updatedAt: '2026-07-10T10:00:00Z' }];
    (db.pdfMetadata.toArray as jest.Mock).mockResolvedValueOnce(mockLocalData);
    
    // Server fetch chain mock
    const eqMock = supabase.from('pdf_metadata').select().eq as unknown as jest.Mock;
    eqMock.mockResolvedValueOnce({ data: [], error: null });

    const { result } = renderHook(() => useMetadataSync('file-123'));

    await waitFor(() => {
      expect(result.current.metadataList).toEqual(mockLocalData);
    });
  });

  it('should save metadata locally and to server', async () => {
    const { result } = renderHook(() => useMetadataSync('file-123'));

    await act(async () => {
      await result.current.saveMetadata(1, 'memo', 'Test text', 'My memo');
    });

    expect(db.pdfMetadata.put).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'file-123',
        page: 1,
        type: 'memo',
        selectedText: 'Test text',
        content: 'My memo',
      })
    );

    const upsertMock = supabase.from('pdf_metadata').upsert;
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        file_id: 'file-123',
        page: 1,
        type: 'memo',
        selected_text: 'Test text',
        content: 'My memo',
      })
    );
  });
});
