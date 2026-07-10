import Dexie, { type EntityTable } from 'dexie';

// 1. PDF Cache Table Interface
export interface PdfCache {
  fileId: string;
  fileName?: string;
  fileSize?: number;
  data: ArrayBuffer;
  updatedAt: string;
}

// 2. Metadata Table Interface (Phase 5)
export interface PdfMetadata {
  id: string;
  fileId: string;
  page: number;
  type: 'bookmark' | 'memo';
  selectedText: string;
  content: string;
  updatedAt: string;
}

const db = new Dexie('SimpleReaderDB') as Dexie & {
  pdfCache: EntityTable<PdfCache, 'fileId'>;
  pdfMetadata: EntityTable<PdfMetadata, 'id'>;
};

// 스키마 선언
db.version(2).stores({
  pdfCache: 'fileId', // Primary key is fileId
  pdfMetadata: 'id, fileId, type', // Primary key is id, indexed by fileId and type
}).upgrade(tx => {
  // Add fileName field to pdfCache in v2, but it's not indexed so no schema change needed in stores string
});

export default db;

// -- Storage Manager Utilities --

export interface StorageStat {
  fileId: string;
  fileName?: string;
  fileSize?: number;
  isCached: boolean;
  memoCount: number;
  bookmarkCount: number;
  updatedAt: string;
}

export async function getStorageStats(): Promise<StorageStat[]> {
  const statsMap = new Map<string, StorageStat>();

  // 1. Process pdfCache
  const caches = await db.pdfCache.toArray();
  for (const cache of caches) {
    statsMap.set(cache.fileId, {
      fileId: cache.fileId,
      fileName: cache.fileName,
      fileSize: cache.fileSize,
      isCached: true,
      memoCount: 0,
      bookmarkCount: 0,
      updatedAt: cache.updatedAt,
    });
  }

  // 2. Process pdfMetadata
  const metadatas = await db.pdfMetadata.toArray();
  for (const meta of metadatas) {
    if (!statsMap.has(meta.fileId)) {
      statsMap.set(meta.fileId, {
        fileId: meta.fileId,
        isCached: false,
        memoCount: 0,
        bookmarkCount: 0,
        updatedAt: meta.updatedAt,
      });
    }

    const stat = statsMap.get(meta.fileId)!;
    if (meta.type === 'memo') stat.memoCount++;
    if (meta.type === 'bookmark') stat.bookmarkCount++;
    
    // Update to most recent timestamp
    if (new Date(meta.updatedAt) > new Date(stat.updatedAt)) {
      stat.updatedAt = meta.updatedAt;
    }
  }

  // 3. Convert map to array and sort by latest updated
  return Array.from(statsMap.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function deletePdfCache(fileId: string): Promise<void> {
  await db.pdfCache.delete(fileId);
}

export async function clearAllPdfCaches(): Promise<void> {
  await db.pdfCache.clear();
}
