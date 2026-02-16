export type TxType = 'income' | 'expense' | 'transfer';
export type CategoryGroup = 'Income' | 'Expense';

export type Account = {
  id: string;
  name: string;
  archived?: boolean;
};

export type Category = {
  id: string;
  name: string;
  group?: CategoryGroup;
  color?: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  limit: number;
};

type BaseTransaction = {
  id: string;
  date: string;
  amount: number;
  type: TxType;
  vendor?: string;
  memo?: string;
};

export type IncomeTransaction = BaseTransaction & {
  type: 'income';
  accountId: string;
  categoryId: string;
};

export type ExpenseTransaction = BaseTransaction & {
  type: 'expense';
  accountId: string;
  categoryId: string;
};

export type TransferTransaction = BaseTransaction & {
  type: 'transfer';
  fromAccountId: string;
  toAccountId: string;
};

export type Transaction = IncomeTransaction | ExpenseTransaction | TransferTransaction;

export type WealthFlowStore = {
  schemaVersion: 2;
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  updatedAt: string;
};
