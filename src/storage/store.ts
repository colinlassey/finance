import type { WealthFlowStore } from '../models/types';
import {
  loadStore as loadStoreFromIndexedDb,
  resetStore as resetStoreInIndexedDb,
  saveStore as saveStoreToIndexedDb,
} from './indexedDb';

export type LoadStoreResult = {
  store: WealthFlowStore;
  warning?: string;
};

export const loadStore = (): Promise<LoadStoreResult> => loadStoreFromIndexedDb();

export const saveStore = (store: WealthFlowStore) => saveStoreToIndexedDb(store);

export const resetStore = () => resetStoreInIndexedDb();

const isArray = (v: unknown) => Array.isArray(v);

export const validateImportedStore = (input: unknown): string | null => {
  if (!input || typeof input !== 'object') return 'Invalid file: JSON object expected.';
  const store = input as Record<string, unknown>;

  if (!isArray(store.accounts)) return 'Invalid file: accounts[] is required.';
  if (!isArray(store.transactions)) return 'Invalid file: transactions[] is required.';
  if (!isArray(store.budgets)) return 'Invalid file: budgets[] is required.';
  if (store.categories !== undefined && !isArray(store.categories)) {
    return 'Invalid file: categories must be an array when present.';
  }

  const invalidAccount = (store.accounts as unknown[]).some(
    (a) => !a || typeof a !== 'object' || !('id' in (a as object)) || !('name' in (a as object)),
  );
  if (invalidAccount) return 'Invalid file: each account must include id and name.';

  const invalidTx = (store.transactions as unknown[]).some(
    (t) =>
      !t ||
      typeof t !== 'object' ||
      !('id' in (t as object)) ||
      !('type' in (t as object)) ||
      !('amount' in (t as object)) ||
      !('date' in (t as object)),
  );
  if (invalidTx) return 'Invalid file: each transaction must include id, type, date, and amount.';

  return null;
};

export const exportStoreBlob = (store: WealthFlowStore) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    store,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
};
