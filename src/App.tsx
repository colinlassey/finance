import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Landmark,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type TxType = 'income' | 'expense';

type Account = {
  id: string;
  name: string;
};

type Budget = {
  id: string;
  category: string;
  limit: number;
};

type Transaction = {
  id: string;
  date: string;
  amount: number;
  category: string;
  vendor: string;
  accountId: string;
  type: TxType;
};

type Store = {
  accounts: Account[];
  budgets: Budget[];
  transactions: Transaction[];
};

const STORAGE_KEY = 'wealthflow.v1';

const initialStore: Store = {
  accounts: [
    { id: crypto.randomUUID(), name: 'Main Checking' },
    { id: crypto.randomUUID(), name: 'Credit Card' },
  ],
  budgets: [
    { id: crypto.randomUUID(), category: 'Dining', limit: 500 },
    { id: crypto.randomUUID(), category: 'Groceries', limit: 700 },
  ],
  transactions: [],
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const monthKey = (date: string) => date.slice(0, 7);

export default function App() {
  const [store, setStore] = useState<Store>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialStore;
    try {
      return JSON.parse(raw) as Store;
    } catch {
      return initialStore;
    }
  });

  const [accountName, setAccountName] = useState('');
  const [budgetDraft, setBudgetDraft] = useState({ category: '', limit: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [txDraft, setTxDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: '',
    vendor: '',
    accountId: '',
    type: 'expense' as TxType,
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    if (!txDraft.accountId && store.accounts[0]) {
      setTxDraft((prev) => ({ ...prev, accountId: store.accounts[0].id }));
    }
  }, [store.accounts, txDraft.accountId]);

  const accountBalances = useMemo(() => {
    const balances = Object.fromEntries(store.accounts.map((a) => [a.id, 0] as const));
    for (const tx of store.transactions) {
      const direction = tx.type === 'income' ? 1 : -1;
      balances[tx.accountId] = (balances[tx.accountId] || 0) + direction * tx.amount;
    }
    return balances;
  }, [store.accounts, store.transactions]);

  const suggestions = useMemo(() => {
    const vendorScores: Record<string, number> = {};
    const categoryScores: Record<string, number> = {};
    const accountScores: Record<string, number> = {};

    const query = txDraft.vendor.toLowerCase();
    for (const tx of store.transactions) {
      const weight = tx.vendor.toLowerCase().includes(query) ? 3 : 1;
      vendorScores[tx.vendor] = (vendorScores[tx.vendor] || 0) + weight;
      categoryScores[tx.category] = (categoryScores[tx.category] || 0) + weight;
      accountScores[tx.accountId] = (accountScores[tx.accountId] || 0) + weight;
    }

    const top = (scores: Record<string, number>) =>
      Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([value]) => value);

    return {
      vendors: top(vendorScores),
      categories: top(categoryScores),
      accounts: top(accountScores)
        .map((id) => store.accounts.find((a) => a.id === id)?.name)
        .filter(Boolean) as string[],
    };
  }, [store.accounts, store.transactions, txDraft.vendor]);

  const months = useMemo(
    () => Array.from(new Set(store.transactions.map((tx) => monthKey(tx.date)))).sort().reverse(),
    [store.transactions],
  );
  const [activeMonth, setActiveMonth] = useState<string>('');

  useEffect(() => {
    if (!activeMonth && months[0]) setActiveMonth(months[0]);
  }, [months, activeMonth]);

  const monthlySnapshot = useMemo(() => {
    const base = { income: 0, expense: 0, categorySpend: {} as Record<string, number> };
    if (!activeMonth) return base;
    return store.transactions
      .filter((tx) => monthKey(tx.date) === activeMonth)
      .reduce((acc, tx) => {
        if (tx.type === 'income') acc.income += tx.amount;
        else {
          acc.expense += tx.amount;
          acc.categorySpend[tx.category] = (acc.categorySpend[tx.category] || 0) + tx.amount;
        }
        return acc;
      }, base);
  }, [activeMonth, store.transactions]);

  const addAccount = () => {
    if (!accountName.trim()) return;
    setStore((prev) => ({
      ...prev,
      accounts: [...prev.accounts, { id: crypto.randomUUID(), name: accountName.trim() }],
    }));
    setAccountName('');
  };

  const saveTransaction = () => {
    const amount = Number(txDraft.amount);
    if (!txDraft.accountId || !txDraft.category || !txDraft.vendor || Number.isNaN(amount) || amount <= 0) return;
    const payload: Transaction = {
      id: editingId || crypto.randomUUID(),
      date: txDraft.date,
      amount,
      category: txDraft.category,
      vendor: txDraft.vendor,
      accountId: txDraft.accountId,
      type: txDraft.type,
    };

    setStore((prev) => ({
      ...prev,
      transactions: editingId
        ? prev.transactions.map((tx) => (tx.id === editingId ? payload : tx))
        : [payload, ...prev.transactions],
    }));

    setEditingId(null);
    setTxDraft((prev) => ({ ...prev, amount: '', vendor: '' }));
  };

  const editTransaction = (tx: Transaction) => {
    setEditingId(tx.id);
    setTxDraft({
      date: tx.date,
      amount: tx.amount.toString(),
      category: tx.category,
      vendor: tx.vendor,
      accountId: tx.accountId,
      type: tx.type,
    });
  };

  const categorySpend = useMemo(() => {
    const sums: Record<string, number> = {};
    store.transactions.forEach((tx) => {
      if (tx.type === 'expense') sums[tx.category] = (sums[tx.category] || 0) + tx.amount;
    });
    return sums;
  }, [store.transactions]);

  const vendorData = useMemo(() => {
    const sums: Record<string, number> = {};
    store.transactions.forEach((tx) => {
      if (tx.type === 'expense') sums[tx.vendor] = (sums[tx.vendor] || 0) + tx.amount;
    });
    return Object.entries(sums)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [store.transactions]);

  const sankeyData = useMemo(() => {
    const nodeIndex = new Map<string, number>();
    const nodes: { name: string }[] = [];
    const links: { source: number; target: number; value: number }[] = [];
    const linkMap = new Map<string, number>();

    const ensureNode = (name: string) => {
      if (nodeIndex.has(name)) return nodeIndex.get(name)!;
      const idx = nodes.length;
      nodes.push({ name });
      nodeIndex.set(name, idx);
      return idx;
    };

    for (const tx of store.transactions) {
      const incomeNode = ensureNode(tx.type === 'income' ? 'Income' : tx.accountId);
      const accountNode = ensureNode(store.accounts.find((a) => a.id === tx.accountId)?.name || 'Unknown');
      const expenseNode = ensureNode(tx.type === 'expense' ? tx.category : tx.accountId);

      if (tx.type === 'income') {
        const key = `${incomeNode}-${accountNode}`;
        const idx = linkMap.get(key);
        if (idx !== undefined) links[idx].value += tx.amount;
        else {
          linkMap.set(key, links.length);
          links.push({ source: incomeNode, target: accountNode, value: tx.amount });
        }
      } else {
        const key = `${accountNode}-${expenseNode}`;
        const idx = linkMap.get(key);
        if (idx !== undefined) links[idx].value += tx.amount;
        else {
          linkMap.set(key, links.length);
          links.push({ source: accountNode, target: expenseNode, value: tx.amount });
        }
      }
    }
    links.sort((a, b) => b.value - a.value);
    return { nodes, links };
  }, [store.accounts, store.transactions]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">WealthFlow</h1>
          <p className="text-zinc-400">Privacy-first personal finance tracker</p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="card lg:col-span-4">
          <h2 className="section-title"><Landmark size={16} /> Accounts</h2>
          <div className="mt-3 flex gap-2">
            <input className="input" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Create account" />
            <button className="btn" onClick={addAccount}><Plus size={14} /></button>
          </div>
          <ul className="mt-4 space-y-2">
            {store.accounts.map((account) => (
              <li key={account.id} className="row">
                <span>{account.name}</span>
                <strong>{formatCurrency(accountBalances[account.id] || 0)}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="card lg:col-span-4">
          <h2 className="section-title"><Wallet size={16} /> Budgets</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input className="input" placeholder="Category" value={budgetDraft.category} onChange={(e) => setBudgetDraft((p) => ({ ...p, category: e.target.value }))} />
            <input className="input" placeholder="Monthly limit" type="number" value={budgetDraft.limit} onChange={(e) => setBudgetDraft((p) => ({ ...p, limit: e.target.value }))} />
          </div>
          <button className="btn mt-2 w-full" onClick={() => {
            const limit = Number(budgetDraft.limit);
            if (!budgetDraft.category || limit <= 0) return;
            setStore((prev) => ({ ...prev, budgets: [...prev.budgets, { id: crypto.randomUUID(), category: budgetDraft.category, limit }] }));
            setBudgetDraft({ category: '', limit: '' });
          }}>Add Budget</button>

          <div className="mt-4 space-y-3">
            {store.budgets.map((budget) => {
              const spent = categorySpend[budget.category] || 0;
              const progress = Math.min(100, (spent / budget.limit) * 100);
              return (
                <div key={budget.id}>
                  <div className="flex justify-between text-sm"><span>{budget.category}</span><span>{formatCurrency(spent)} / {formatCurrency(budget.limit)}</span></div>
                  <div className="h-2 bg-zinc-800 rounded mt-1 overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${progress}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card lg:col-span-4">
          <h2 className="section-title"><ArrowDownUp size={16} /> Transaction Entry</h2>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <input className="input" type="date" value={txDraft.date} onChange={(e) => setTxDraft((p) => ({ ...p, date: e.target.value }))} />
            <select className="input" value={txDraft.type} onChange={(e) => setTxDraft((p) => ({ ...p, type: e.target.value as TxType }))}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input className="input" type="number" placeholder="Amount" value={txDraft.amount} onChange={(e) => setTxDraft((p) => ({ ...p, amount: e.target.value }))} />
            <input className="input" placeholder="Vendor" value={txDraft.vendor} onChange={(e) => setTxDraft((p) => ({ ...p, vendor: e.target.value }))} />
            <input className="input" placeholder="Category" value={txDraft.category} onChange={(e) => setTxDraft((p) => ({ ...p, category: e.target.value }))} />
            <select className="input" value={txDraft.accountId} onChange={(e) => setTxDraft((p) => ({ ...p, accountId: e.target.value }))}>
              {store.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="mt-3 text-xs text-zinc-400">
            <p>Suggestions: Vendor {suggestions.vendors.join(', ') || '—'} | Category {suggestions.categories.join(', ') || '—'} | Account {suggestions.accounts.join(', ') || '—'}</p>
          </div>
          <button className="btn mt-3 w-full" onClick={saveTransaction}>{editingId ? 'Update' : 'Add'} Transaction</button>
        </section>

        <section className="card lg:col-span-8">
          <h2 className="section-title">Ledger (Infinite History)</h2>
          <div className="max-h-72 overflow-auto mt-3 space-y-2 pr-2">
            {store.transactions.map((tx) => (
              <div key={tx.id} className="row">
                <div>
                  <p className="font-medium">{tx.vendor} · {tx.category}</p>
                  <p className="text-xs text-zinc-400">{tx.date} · {store.accounts.find((a) => a.id === tx.accountId)?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={tx.type === 'expense' ? 'text-rose-300' : 'text-emerald-300'}>
                    {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
                  </span>
                  <button className="icon-btn" onClick={() => editTransaction(tx)}>Edit</button>
                  <button className="icon-btn" onClick={() => setStore((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== tx.id) }))}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card lg:col-span-4">
          <h2 className="section-title">Monthly Statements</h2>
          <select className="input mt-3" value={activeMonth} onChange={(e) => setActiveMonth(e.target.value)}>
            {months.map((month) => <option key={month} value={month}>{month}</option>)}
          </select>
          <div className="mt-4 space-y-1 text-sm">
            <p>Income: <strong>{formatCurrency(monthlySnapshot.income)}</strong></p>
            <p>Expenses: <strong>{formatCurrency(monthlySnapshot.expense)}</strong></p>
            <p>Net Flow: <strong>{formatCurrency(monthlySnapshot.income - monthlySnapshot.expense)}</strong></p>
          </div>
        </section>

        <section className="card lg:col-span-12 h-[340px]">
          <h2 className="section-title">Cash Flow Sankey (Income → Accounts → Expenses)</h2>
          <ResponsiveContainer width="100%" height="100%">
            <Sankey data={sankeyData} nodePadding={28} margin={{ left: 20, right: 20, top: 30, bottom: 20 }} link={{ stroke: '#60a5fa' }}>
              <Tooltip />
            </Sankey>
          </ResponsiveContainer>
        </section>

        <section className="card lg:col-span-6 h-[300px]">
          <h2 className="section-title">Top Vendors by Spend</h2>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={vendorData} dataKey="value" nameKey="name" outerRadius={95} label>
                {vendorData.map((_, idx) => <Cell key={idx} fill={["#22c55e", "#60a5fa", "#f59e0b", "#f43f5e", "#a78bfa"][idx % 5]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="card lg:col-span-6 h-[300px]">
          <h2 className="section-title">Category Spend</h2>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={Object.entries(categorySpend).map(([name, value]) => ({ name, value }))}>
              <XAxis dataKey="name" stroke="#a1a1aa" />
              <YAxis stroke="#a1a1aa" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  );
}
