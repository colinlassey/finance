import { formatCurrency } from '../lib/format';

type Props = {
  months: string[];
  activeMonth: string;
  setActiveMonth: (month: string) => void;
  income: number;
  expense: number;
  topCategories: { name: string; amount: number }[];
};

export const MonthlySnapshotPanel = ({ months, activeMonth, setActiveMonth, income, expense, topCategories }: Props) => (
  <section className="card lg:col-span-4">
    <h2 className="section-title">Monthly Statements</h2>
    <select className="input mt-3" value={activeMonth} onChange={(e) => setActiveMonth(e.target.value)}>
      {months.map((m) => <option key={m} value={m}>{m}</option>)}
    </select>
    <div className="mt-4 space-y-1 text-sm">
      <p>Income: <strong>{formatCurrency(income)}</strong></p>
      <p>Expenses: <strong>{formatCurrency(expense)}</strong></p>
      <p>Net Flow: <strong>{formatCurrency(income - expense)}</strong></p>
    </div>

    <div className="mt-4 border-t border-zinc-800 pt-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">Top categories</p>
      <div className="mt-2 space-y-1 text-sm">
        {topCategories.length === 0 ? (
          <p className="text-zinc-500">No spending categories for this month.</p>
        ) : (
          topCategories.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <span>{item.name}</span>
              <strong>{formatCurrency(item.amount)}</strong>
            </div>
          ))
        )}
      </div>
    </div>
  </section>
);
