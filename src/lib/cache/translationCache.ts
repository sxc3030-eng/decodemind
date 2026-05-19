const DB_NAME = 'decodemind-translation-cache';
const STORE = 'translations';
const VERSION = 1;

export interface CacheEntry {
  key: string;            // ruleId + ':' + sha256-hash-of-normalizedCode
  ruleId: string;
  language: 'en' | 'fr';
  modelTier: string;
  content: string;
  createdAt: number;
  lastAccessAt: number;
  bytes: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'key' });
          store.createIndex('lastAccessAt', 'lastAccessAt', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

/**
 * Normalize a code snippet for stable cache keys across lexically-different
 * but semantically-identical findings.
 *
 * - Strip leading/trailing whitespace and collapse internal whitespace runs.
 * - Strip inline comments: Python (#), JS (//), block (/* ... *\/), HTML (<!-- ... -->).
 * - Replace string literals (single/double quoted) with "<STR>".
 * - Replace number literals with <NUM>.
 * - Replace SCREAMING_SNAKE identifiers (likely constants) with <CONST>.
 */
export function normalizeCode(snippet: string): string {
  let s = snippet;
  // Strip block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // Strip line comments (Python #, JS //)
  s = s.replace(/(^|\s)#[^\n]*/g, '$1');
  s = s.replace(/\/\/[^\n]*/g, '');
  // Replace SCREAMING_SNAKE identifiers FIRST (before string/number replacements
  // insert placeholder text that would otherwise be re-matched)
  s = s.replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, '<CONST>');
  // Replace string literals
  s = s.replace(/'(?:\\.|[^'\\])*'/g, '"<STR>"');
  s = s.replace(/"(?:\\.|[^"\\])*"/g, '"<STR>"');
  s = s.replace(/`(?:\\.|[^`\\])*`/g, '"<STR>"');
  // Replace number literals (basic — won't catch exponents perfectly but good enough)
  s = s.replace(/\b\d+(?:\.\d+)?\b/g, '<NUM>');
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

async function hash(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32); // truncate
}

export async function makeKey(ruleId: string, snippet: string, language: string): Promise<string> {
  const normalized = normalizeCode(snippet);
  const h = await hash(normalized);
  return `${language}:${ruleId}:${h}`;
}

export async function getCached(key: string): Promise<CacheEntry | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      const entry = req.result as CacheEntry | undefined;
      if (entry) {
        entry.lastAccessAt = Date.now();
        store.put(entry);
      }
      resolve(entry ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function putCached(entry: Omit<CacheEntry, 'createdAt' | 'lastAccessAt' | 'bytes'>): Promise<void> {
  const db = await openDb();
  const now = Date.now();
  const full: CacheEntry = {
    ...entry,
    createdAt: now,
    lastAccessAt: now,
    bytes: new TextEncoder().encode(entry.content).length,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(full);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCacheStats(): Promise<{ entries: number; bytes: number }> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const countReq = store.count();
    let totalBytes = 0;
    let entries = 0;
    store.openCursor().onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const entry = cursor.value as CacheEntry;
        totalBytes += entry.bytes;
        cursor.continue();
      }
    };
    countReq.onsuccess = () => {
      entries = countReq.result;
    };
    tx.oncomplete = () => resolve({ entries, bytes: totalBytes });
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearCache(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const MAX_CACHE_BYTES = 50 * 1024 * 1024; // 50 MB

/** LRU evict if cache exceeds MAX_CACHE_BYTES. Call after putCached. */
export async function evictIfNeeded(): Promise<number> {
  const { bytes } = await getCacheStats();
  if (bytes <= MAX_CACHE_BYTES) return 0;
  const target = Math.floor(MAX_CACHE_BYTES * 0.8); // evict down to 80%
  const db = await openDb();
  let evicted = 0;
  let runningBytes = bytes;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const index = store.index('lastAccessAt');
    index.openCursor().onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (!cursor || runningBytes <= target) return;
      const entry = cursor.value as CacheEntry;
      runningBytes -= entry.bytes;
      evicted++;
      cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve(evicted);
    tx.onerror = () => reject(tx.error);
  });
}
