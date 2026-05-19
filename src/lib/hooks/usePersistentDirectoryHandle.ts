import { useEffect, useState } from 'react';

const DB_NAME = 'decodemind-handles';
const STORE = 'handles';
const KEY = 'last-folder';

async function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface PersistentHandleResult {
  lastHandle: FileSystemDirectoryHandle | null;
  saveHandle: (handle: FileSystemDirectoryHandle) => Promise<void>;
  clearHandle: () => Promise<void>;
  verifyPermission: (handle: FileSystemDirectoryHandle) => Promise<boolean>;
}

export function usePersistentDirectoryHandle(): PersistentHandleResult {
  const [lastHandle, setLastHandle] = useState<FileSystemDirectoryHandle | null>(null);

  useEffect(() => {
    idbGet<FileSystemDirectoryHandle>(KEY).then((h) => {
      if (h) setLastHandle(h);
    }).catch(() => { /* ignore */ });
  }, []);

  return {
    lastHandle,
    saveHandle: async (handle: FileSystemDirectoryHandle) => {
      await idbPut(KEY, handle);
      setLastHandle(handle);
    },
    clearHandle: async () => {
      await idbPut(KEY, null);
      setLastHandle(null);
    },
    verifyPermission: async (handle: FileSystemDirectoryHandle) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const h = handle as any;
      const state = await h.queryPermission({ mode: 'read' });
      if (state === 'granted') return true;
      const requested = await h.requestPermission({ mode: 'read' });
      return requested === 'granted';
    },
  };
}
