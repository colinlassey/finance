import { ArrowDownUp } from 'lucide-react';
import type { Account, Category, Transaction, TxType } from '../models/types';
import { suggestionLabel } from '../lib/suggestions';

type Draft = {
  date: string;
  amount: string;
  type: TxType;
  accountId: string;
  categoryId: string;
  vendor: string;
  fromAccountId: string;
  toAccountId: string;
};

type Suggestion = {
  vendor: string;
  categoryId?: string;
  accountId?: string;
};

type Props = {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  editingId: string | null;
  accounts: Account[];
  categories: Category[];
  suggestions: Suggestion[];
  onSubmit: () => void;
};

export const TransactionForm = ({ draft, setDraft, editingId, accounts, categories, suggestions, onSubmit }: Props) => (
  <section className="card lg:col-span-4">
    <h2 className="section-title"><ArrowDownUp size={16} /> Transaction Entry</h2>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <input className="input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
      <select className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as TxType })}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
        <option value="transfer">Transfer</option>
      </select>
      <input className="input" type="number" placeholder="Amount" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
      <input className="input" placeholder="Vendor / Memo" value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} />

      {draft.type === 'transfer' ? (
        <>
          <select className="input" value={draft.fromAccountId} onChange={(e) => setDraft({ ...draft, fromAccountId: e.target.value })}>
            <option value="">From account</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="input" value={draft.toAccountId} onChange={(e) => setDraft({ ...draft, toAccountId: e.target.value })}>
            <option value="">To account</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </>
      ) : (
        <>
          <select className="input" value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
            <option value="">Category</option>
            {categories
              .filter((c) => draft.type === 'income' ? c.group === 'Income' : c.group !== 'Income')
              .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}>
            <option value="">Account</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </>
      )}
    </div>

    {draft.type !== 'transfer' && suggestions.length > 0 ? (
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {suggestions.map((s, idx) => (
          <button
            key={`${s.vendor}-${idx}`}
            className="rounded-full border border-zinc-700 px-2 py-1 hover:bg-zinc-800"
            onClick={() => setDraft({
              ...draft,
              vendor: s.vendor,
              categoryId: s.categoryId || draft.categoryId,
              accountId: s.accountId || draft.accountId,
            })}
          >
            {suggestionLabel(s, categories, accounts)}
          </button>
        ))}
      </div>
    ) : null}

    <button className="btn mt-3 w-full" onClick={onSubmit}>{editingId ? 'Update' : 'Add'} Transaction</button>
  </section>
);

export const toDraft = (tx: Transaction): Draft => {
  if (tx.type === 'transfer') {
    return {
      date: tx.date,
      amount: `${tx.amount}`,
      type: 'transfer',
      accountId: '',
      categoryId: '',
      vendor: tx.vendor || tx.memo || '',
      fromAccountId: tx.fromAccountId,
      toAccountId: tx.toAccountId,
    };
  }

  return {
    date: tx.date,
    amount: `${tx.amount}`,
    type: tx.type,
    accountId: tx.accountId,
    categoryId: tx.categoryId,
    vendor: tx.vendor || '',
    fromAccountId: '',
    toAccountId: '',
  };
};
