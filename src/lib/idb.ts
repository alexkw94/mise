/**
 * Blob store for photos and nutrition-table screenshots.
 *
 * Images deliberately do NOT live in the JSON state: localStorage caps at
 * ~5 MB and a couple of phone photos would blow it. Records hold an id here,
 * which is the same shape a Supabase Storage path takes later — swapping the
 * backend means reimplementing these four functions and nothing else.
 */

const DB_NAME = "mlk-images";
const STORE = "blobs";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function putImage(id: string, blob: Blob): Promise<void> {
  return tx("readwrite", (s) => s.put(blob, id)).then(() => undefined);
}

export function getImage(id: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>("readonly", (s) => s.get(id));
}

export function deleteImage(id: string): Promise<void> {
  return tx("readwrite", (s) => s.delete(id)).then(() => undefined);
}

export function listImageIds(): Promise<string[]> {
  return tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys()).then((keys) =>
    keys.map(String),
  );
}
