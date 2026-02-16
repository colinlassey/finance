import type { Account, Category, Transaction } from '../models/types';
import { daysAgo } from './date';

type Suggestion = {
  vendor: string;
  categoryId?: string;
  accountId?: string;
  score: number;
};

const recencyWeight = (dateStr: string) => {
  const recentCutoff = daysAgo(90);
  return new Date(dateStr) >= recentCutoff ? 2.5 : 1;
};

export const getVendorSuggestions = (
  transactions: Transaction[],
  query: string,
): Suggestion[] => {
  const q = query.trim().toLowerCase();
  const scores = new Map<string, Suggestion>();

  for (const tx of transactions) {
    if (tx.type === 'transfer') continue;
    const vendor = (tx.vendor || '').trim();
    if (!vendor) continue;

    const base = recencyWeight(tx.date) * (vendor.toLowerCase().includes(q) || !q ? 2 : 0.3);
    const key = `${vendor}::${tx.categoryId}::${tx.accountId}`;
    const existing = scores.get(key);
    if (existing) existing.score += base;
    else {
      scores.set(key, {
        vendor,
        categoryId: tx.categoryId,
        accountId: tx.accountId,
        score: base,
      });
    }
  }

  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 5);
};

export const suggestionLabel = (
  suggestion: Suggestion,
  categories: Category[],
  accounts: Account[],
) => {
  const category = categories.find((c) => c.id === suggestion.categoryId)?.name ?? '—';
  const account = accounts.find((a) => a.id === suggestion.accountId)?.name ?? '—';
  return `${suggestion.vendor} · ${category} · ${account}`;
};
