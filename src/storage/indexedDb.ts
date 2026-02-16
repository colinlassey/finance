import type { Account, Budget, Category, Transaction, WealthFlowStore } from '../models/types';
import { createDefaultStore, migrateStore } from './migrations';

const DB_NAME = 'wealthflow-db';
const DB_VERSION = 1;
const META_KEY = 'store-meta';
const LS_LEGACY_KEY = 'wealthflow.v1';
const LS_MIGRATED_KEY = 'wealthflow.migratedToIDB';

type LoadResult = {
  store: WealthFlowStore;
  warning?: string;
};

type MetaRecord = Pick<WealthFlowStore, 'schemaVersion' | 'updatedAt'> & { id: string };

const toPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const txDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('accounts')) db.createObjectStore('accounts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('categories')) db.createObjectStore('categories', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('budgets')) db.createObjectStore('budgets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('transactions')) db.createObjectStore('transactions', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const getAll = async <T>(db: IDBDatabase, storeName: string) => {
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const results = await toPromise(store.getAll() as IDBRequest<T[]>);
  await txDone(tx);
  return results;
};

const clearStore = async (db: IDBDatabase, storeName: string) => {
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).clear();
  await txDone(tx);
};

const clearAndPutAll = async <T extends { id: string }>(db: IDBDatabase, storeName: string, data: T[]) => {
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  store.clear();
  for (const item of data) {
    store.put(item);
  }
  await txDone(tx);
};

const saveMeta = async (db: IDBDatabase, meta: MetaRecord) => {
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put(meta);
  await txDone(tx);
};

const readMeta = async (db: IDBDatabase) => {
  const tx = db.transaction('meta', 'readonly');
  const request = tx.objectStore('meta').get(META_KEY);
  const meta = await toPromise(request as IDBRequest<MetaRecord | undefined>);
  await txDone(tx);
  return meta;
};

const migrateLegacyLocalStorageOnce = async (db: IDBDatabase) => {
  if (localStorage.getItem(LS_MIGRATED_KEY) === 'true') return;

  const legacyRaw = localStorage.getItem(LS_LEGACY_KEY);
  if (!legacyRaw) {
    localStorage.setItem(LS_MIGRATED_KEY, 'true');
    return;
  }

  try {
    const legacyParsed = JSON.parse(legacyRaw);
    const migrated = migrateStore(legacyParsed);
    await saveStoreToDb(db, migrated);
  } catch {
    // ignore parse failures and continue with fresh indexedDB data
  }

  localStorage.setItem(LS_MIGRATED_KEY, 'true');
};

const saveStoreToDb = async (db: IDBDatabase, store: WealthFlowStore) => {
  const updatedAt = new Date().toISOString();
  await Promise.all([
    clearAndPutAll<Account>(db, 'accounts', store.accounts),
    clearAndPutAll<Category>(db, 'categories', store.categories),
    clearAndPutAll<Budget>(db, 'budgets', store.budgets),
    clearAndPutAll<Transaction>(db, 'transactions', store.transactions),
  ]);
  await saveMeta(db, { id: META_KEY, schemaVersion: store.schemaVersion, updatedAt });
};

export const loadStore = async (): Promise<LoadResult> => {
  try {
    const db = await openDb();
    await migrateLegacyLocalStorageOnce(db);

    const [meta, accounts, categories, budgets, transactions] = await Promise.all([
      readMeta(db),
      getAll<Account>(db, 'accounts'),
      getAll<Category>(db, 'categories'),
      getAll<Budget>(db, 'budgets'),
      getAll<Transaction>(db, 'transactions'),
    ]);

    if (!meta && accounts.length === 0 && categories.length === 0 && budgets.length === 0 && transactions.length === 0) {
      const initial = createDefaultStore();
      await saveStoreToDb(db, initial);
      db.close();
      return { store: initial };
    }

    const migrated = migrateStore({
      schemaVersion: meta?.schemaVersion,
      updatedAt: meta?.updatedAt,
      accounts,
      categories,
      budgets,
      transactions,
    });

    await saveStoreToDb(db, migrated);
    db.close();
    return { store: migrated };
  } catch {
    return {
      store: createDefaultStore(),
      warning: 'We could not access local database storage. WealthFlow started with a fresh local workspace.',
    };
  }
};

export const saveStore = async (store: WealthFlowStore): Promise<void> => {
  try {
    const db = await openDb();
    await saveStoreToDb(db, store);
    db.close();
  } catch {
    // silent fail to avoid blocking UX
  }
};

export const resetStore = async (): Promise<void> => {
  try {
    const db = await openDb();
    await Promise.all([
      clearStore(db, 'accounts'),
      clearStore(db, 'categories'),
      clearStore(db, 'budgets'),
      clearStore(db, 'transactions'),
    ]);
    await saveMeta(db, { id: META_KEY, schemaVersion: 2, updatedAt: new Date().toISOString() });
    db.close();
  } catch {
    // no-op
  }
};
