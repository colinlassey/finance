import { ChevronDown, Trash2 } from 'lucide-react';
import type { Account, Category, Transaction } from '../models/types';
import { formatCurrency } from '../lib/format';

type Props = {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  visibleCount: number;
  onLoadMore: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
};

export const LedgerPanel = ({ transactions, accounts, categories, visibleCount, onLoadMore, onEdit, onDelete }: Props) => (
  <section className="card lg:col-span-8">
    <h2 className="section-title">Ledger History (Infinite)</h2>
    <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-2">
      {transactions.slice(0, visibleCount).map((tx) => {
        const isTransfer = tx.type === 'transfer';
        const desc = isTransfer
          ? `Transfer: ${accounts.find((a) => a.id === tx.fromAccountId)?.name || 'Unknown'} → ${accounts.find((a) => a.id === tx.toAccountId)?.name || 'Unknown'}`
          : `${tx.vendor || 'Manual Entry'} · ${categories.find((c) => c.id === tx.categoryId)?.name || 'Unknown'}`;

        return (
          <div key={tx.id} className="row">
            <div>
              <p className="font-medium">{desc}</p>
              <p className="text-xs text-zinc-400">{tx.date}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={tx.type === 'income' ? 'text-emerald-300' : tx.type === 'expense' ? 'text-rose-300' : 'text-sky-300'}>
                {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '⇄'}{formatCurrency(tx.amount)}
              </span>
              <button className="icon-btn" onClick={() => onEdit(tx)}>Edit</button>
              <button className="icon-btn" onClick={() => onDelete(tx.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        );
      })}
    </div>

    {visibleCount < transactions.length ? (
      <button className="btn mt-3 w-full" onClick={onLoadMore}><ChevronDown size={14} /> Load older transactions</button>
    ) : (
      <p className="mt-3 text-xs text-zinc-500">Showing full history ({transactions.length} transactions).</p>
    )}
  </section>
);
