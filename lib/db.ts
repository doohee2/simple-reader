import Dexie, { type EntityTable } from 'dexie';

// 1. PDF Cache Table Interface
export interface PdfCache {
  fileId: string;
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
db.version(1).stores({
  pdfCache: 'fileId', // Primary key is fileId
  pdfMetadata: 'id, fileId, type', // Primary key is id, indexed by fileId and type
});

export default db;
