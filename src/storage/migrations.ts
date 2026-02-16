import { uid } from '../lib/uid';
import type { Category, WealthFlowStore } from '../models/types';

type LegacyTx = {
  id: string;
  date: string;
  amount: number;
  category: string;
  vendor: string;
  accountId: string;
  type: 'income' | 'expense';
};

type LegacyStore = {
  accounts?: { id: string; name: string }[];
  budgets?: { id: string; category: string; limit: number }[];
  transactions?: LegacyTx[];
};

const defaultCategories: Category[] = [
  { id: uid(), name: 'Salary', group: 'Income', color: '#22c55e' },
  { id: uid(), name: 'Dining', group: 'Expense', color: '#f97316' },
  { id: uid(), name: 'Groceries', group: 'Expense', color: '#60a5fa' },
];

export const createDefaultStore = (): WealthFlowStore => {
  const checkingId = uid();
  const cardId = uid();
  return {
    schemaVersion: 2,
    accounts: [
      { id: checkingId, name: 'Main Checking' },
      { id: cardId, name: 'Credit Card' },
    ],
    categories: defaultCategories,
    budgets: [
      {
        id: uid(),
        categoryId: defaultCategories.find((c) => c.name === 'Dining')?.id || defaultCategories[1].id,
        limit: 500,
      },
    ],
    transactions: [],
    updatedAt: new Date().toISOString(),
  };
};

export const migrateStore = (input: unknown): WealthFlowStore => {
  if (!input || typeof input !== 'object') return createDefaultStore();
  const maybeStore = input as Partial<WealthFlowStore> & LegacyStore;

  if (maybeStore.schemaVersion === 2 && Array.isArray(maybeStore.categories)) {
    return {
      schemaVersion: 2,
      accounts: maybeStore.accounts || [],
      categories: maybeStore.categories,
      budgets: maybeStore.budgets || [],
      transactions: (maybeStore.transactions || []) as WealthFlowStore['transactions'],
      updatedAt: maybeStore.updatedAt || new Date().toISOString(),
    };
  }

  const accounts = maybeStore.accounts || [];
  const transactions = maybeStore.transactions || [];
  const budgets = maybeStore.budgets || [];

  const catMap = new Map<string, Category>();
  const ensureCategory = (name: string, type: 'income' | 'expense') => {
    const safe = name?.trim() || (type === 'income' ? 'Income' : 'Uncategorized');
    if (catMap.has(safe.toLowerCase())) return catMap.get(safe.toLowerCase())!;
    const category: Category = {
      id: uid(),
      name: safe,
      group: type === 'income' ? 'Income' : 'Expense',
    };
    catMap.set(safe.toLowerCase(), category);
    return category;
  };

  const migratedTransactions = transactions.map((tx) => {
    const category = ensureCategory(tx.category, tx.type);
    return {
      id: tx.id || uid(),
      date: tx.date,
      amount: tx.amount,
      type: tx.type,
      vendor: tx.vendor,
      accountId: tx.accountId,
      categoryId: category.id,
    };
  });

  const migratedBudgets = budgets.map((budget) => {
    const category = ensureCategory(budget.category, 'expense');
    return {
      id: budget.id || uid(),
      categoryId: category.id,
      limit: budget.limit,
    };
  });

  const categories = [...catMap.values()];

  return {
    schemaVersion: 2,
    accounts,
    categories,
    budgets: migratedBudgets,
    transactions: migratedTransactions,
    updatedAt: new Date().toISOString(),
  };
};
