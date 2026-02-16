import { formatCurrency } from '../lib/format';

type Props = {
  months: string[];
  activeMonth: string;
  setActiveMonth: (month: string) => void;
  income: number;
  expense: number;
};

export const MonthlySnapshotPanel = ({ months, activeMonth, setActiveMonth, income, expense }: Props) => (
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
  </section>
);
