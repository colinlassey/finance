import { Wallet, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Budget, Category } from '../models/types';
import { formatCurrency } from '../lib/format';

type Props = {
  budgets: Budget[];
  categories: Category[];
  categorySpend: Record<string, number>;
  onCreate: (categoryId: string, limit: number) => void;
};

export const BudgetsPanel = ({ budgets, categories, categorySpend, onCreate }: Props) => {
  const [categoryId, setCategoryId] = useState('');
  const [limit, setLimit] = useState('');

  return (
    <section className="card lg:col-span-4">
      <h2 className="section-title"><Wallet size={16} /> Budgets</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Select category</option>
          {categories.filter((c) => c.group !== 'Income').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input" type="number" placeholder="Monthly limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
      </div>
      <button className="btn mt-2 w-full" onClick={() => {
        const parsed = Number(limit);
        if (!categoryId || parsed <= 0) return;
        onCreate(categoryId, parsed);
        setLimit('');
      }}><Plus size={14} /> Add Budget</button>

      <div className="mt-4 space-y-3">
        {budgets.map((budget) => {
          const categoryName = categories.find((c) => c.id === budget.categoryId)?.name || 'Unknown';
          const spent = categorySpend[budget.categoryId] || 0;
          const progress = Math.min(100, (spent / budget.limit) * 100);
          return (
            <div key={budget.id}>
              <div className="flex justify-between text-sm">
                <span>{categoryName}</span>
                <span>{formatCurrency(spent)} / {formatCurrency(budget.limit)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded bg-zinc-800">
                <div className="h-full bg-emerald-400" style={{ width: `${progress}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
