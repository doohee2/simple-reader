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
  fileName?: string;
  page: number;
  type: 'bookmark' | 'memo';
  selectedText: string;
  content: string;
  updatedAt: string;
  deletedAt?: string;
  isUnsynced?: boolean;
}

// 3. AI History Table Interface
export interface AiHistory {
  id: string;
  fileId: string;
  type: 'translate' | 'summary';
  selectedText: string;
  result: string;
  createdAt: string;
  page: number;
}

const db = new Dexie('SimpleReaderDB') as Dexie & {
  pdfCache: EntityTable<PdfCache, 'fileId'>;
  pdfMetadata: EntityTable<PdfMetadata, 'id'>;
  aiHistory: EntityTable<AiHistory, 'id'>;
};

// 스키마 선언
db.version(4).stores({
  pdfCache: 'fileId', // Primary key is fileId
  pdfMetadata: 'id, fileId, type', // Primary key is id, indexed by fileId and type
  aiHistory: 'id, fileId, createdAt',
}).upgrade(() => {
  // Version 2: Add fileName field to pdfCache
  // Version 3: Add deletedAt field to pdfMetadata
  // Version 4: Add aiHistory table
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
    if (meta.deletedAt) continue;

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
    if (!stat.fileName && meta.fileName) {
      stat.fileName = meta.fileName;
    }
    
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
