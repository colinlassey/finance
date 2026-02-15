import type { Transaction } from './types';

export const deriveAccountBalances = (transactions: Transaction[]) => {
  const balances: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.type === 'transfer') {
      balances[tx.fromAccountId] = (balances[tx.fromAccountId] || 0) - tx.amount;
      balances[tx.toAccountId] = (balances[tx.toAccountId] || 0) + tx.amount;
      continue;
    }

    const direction = tx.type === 'income' ? 1 : -1;
    balances[tx.accountId] = (balances[tx.accountId] || 0) + direction * tx.amount;
  }

  return balances;
};
