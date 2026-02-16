import type { Account, Category, Transaction } from '../models/types';
import { daysAgo } from './date';

type Suggestion = {
  vendor: string;
  categoryId?: string;
  accountId?: string;
  score: number;
};

const recencyWeight = (dateStr: string) => {
  const txDate = new Date(dateStr);
  if (txDate >= daysAgo(30)) return 3;
  if (txDate >= daysAgo(90)) return 2;
  return 1;
};

const vendorQueryWeight = (vendor: string, query: string) => {
  if (!query) return 1.2;
  const lower = vendor.toLowerCase();
  if (lower.startsWith(query)) return 3;
  if (lower.includes(query)) return 1.5;
  return 0.2;
};

export const getVendorSuggestions = (transactions: Transaction[], query: string): Suggestion[] => {
  const q = query.trim().toLowerCase();
  const scores = new Map<string, Suggestion>();

  for (const tx of transactions) {
    if (tx.type === 'transfer') continue;
    const vendor = (tx.vendor || '').trim();
    if (!vendor) continue;

    const score = recencyWeight(tx.date) * vendorQueryWeight(vendor, q);
    const key = `${vendor}::${tx.categoryId}::${tx.accountId}`;
    const existing = scores.get(key);

    if (existing) {
      existing.score += score;
    } else {
      scores.set(key, {
        vendor,
        categoryId: tx.categoryId,
        accountId: tx.accountId,
        score,
      });
    }
  }

  return [...scores.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.vendor.localeCompare(b.vendor);
    })
    .slice(0, 5);
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
