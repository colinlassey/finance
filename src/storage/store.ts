import { migrateStore } from './migrations';
import type { WealthFlowStore } from '../models/types';

export const STORAGE_KEY = 'wealthflow.v1';

export const loadStore = (): WealthFlowStore => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return migrateStore(undefined);

  try {
    const parsed = JSON.parse(raw);
    const migrated = migrateStore(parsed);
    if (migrated !== parsed) saveStore(migrated);
    return migrated;
  } catch {
    return migrateStore(undefined);
  }
};

export const saveStore = (store: WealthFlowStore) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...store, updatedAt: new Date().toISOString() }),
  );
};

const isArray = (v: unknown) => Array.isArray(v);

export const validateImportedStore = (input: unknown): string | null => {
  if (!input || typeof input !== 'object') return 'Invalid file: JSON object expected.';
  const store = input as Record<string, unknown>;
  if (!isArray(store.accounts)) return 'Invalid file: accounts[] is required.';
  if (!isArray(store.categories)) return 'Invalid file: categories[] is required.';
  if (!isArray(store.transactions)) return 'Invalid file: transactions[] is required.';
  if (!isArray(store.budgets)) return 'Invalid file: budgets[] is required.';

  const invalidAccount = (store.accounts as unknown[]).some(
    (a) => !a || typeof a !== 'object' || !('id' in (a as object)) || !('name' in (a as object)),
  );
  if (invalidAccount) return 'Invalid file: each account must include id and name.';

  const invalidTx = (store.transactions as unknown[]).some(
    (t) => !t || typeof t !== 'object' || !('id' in (t as object)) || !('type' in (t as object)) || !('amount' in (t as object)),
  );
  if (invalidTx) return 'Invalid file: each transaction must include id, type, and amount.';

  return null;
};

export const exportStoreBlob = (store: WealthFlowStore) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    store,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
};
