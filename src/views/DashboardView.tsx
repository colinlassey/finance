import { useEffect, useMemo, useState } from 'react';
import { AccountsPanel } from '../components/AccountsPanel';
import { AnalyticsPanel } from '../components/AnalyticsPanel';
import { BudgetsPanel } from '../components/BudgetsPanel';
import { CategoriesPanel } from '../components/CategoriesPanel';
import { ConfirmModal } from '../components/ConfirmModal';
import { LedgerPanel } from '../components/LedgerPanel';
import { MonthlySnapshotPanel } from '../components/MonthlySnapshotPanel';
import { SettingsPanel } from '../components/SettingsPanel';
import { toDraft, TransactionForm } from '../components/TransactionForm';
import { monthKey, previousMonthKey } from '../lib/date';
import { uid } from '../lib/uid';
import { getVendorSuggestions } from '../lib/suggestions';
import { deriveAccountBalances } from '../models/ledger';
import type { Transaction, TxType, WealthFlowStore } from '../models/types';
import { migrateStore } from '../storage/migrations';
import { exportStoreBlob, loadStore, resetStore, saveStore, validateImportedStore } from '../storage/store';

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

const defaultDraft = (): Draft => ({
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  type: 'expense',
  accountId: '',
  categoryId: '',
  vendor: '',
  fromAccountId: '',
  toAccountId: '',
});

const PAGE_SIZE = 25;

export const DashboardView = () => {
  const [store, setStore] = useState<WealthFlowStore | null>(null);
  const [loadWarning, setLoadWarning] = useState('');
  const [draft, setDraft] = useState<Draft>(defaultDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [txError, setTxError] = useState('');
  const [activeMonth, setActiveMonth] = useState(previousMonthKey());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [reassignAccountId, setReassignAccountId] = useState('');

  useEffect(() => {
    let mounted = true;
    loadStore().then((result) => {
      if (!mounted) return;
      setStore(result.store);
      if (result.warning) setLoadWarning(result.warning);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!store) return;
    saveStore(store);
  }, [store]);

  const balances = useMemo(
    () => (store ? deriveAccountBalances(store.transactions) : {}),
    [store],
  );

  const suggestions = useMemo(
    () => (store ? getVendorSuggestions(store.transactions, draft.vendor) : []),
    [store, draft.vendor],
  );

  const months = useMemo(() => {
    if (!store) return [previousMonthKey()];
    const monthSet = new Set(store.transactions.map((t) => monthKey(t.date)));
    monthSet.add(previousMonthKey());
    return [...monthSet].sort().reverse();
  }, [store]);

  useEffect(() => {
    if (!months.includes(activeMonth)) {
      setActiveMonth(previousMonthKey());
    }
  }, [months, activeMonth]);

  useEffect(() => {
    if (!store) return;
    if (!draft.accountId && store.accounts[0]) {
      setDraft((d) => ({ ...d, accountId: store.accounts[0].id, fromAccountId: store.accounts[0].id }));
    }
  }, [draft.accountId, store]);

  const monthly = useMemo(() => {
    if (!store) return { income: 0, expense: 0, categories: {} as Record<string, number> };

    const payload = { income: 0, expense: 0, categories: {} as Record<string, number> };
    for (const tx of store.transactions) {
      if (monthKey(tx.date) !== activeMonth) continue;
      if (tx.type === 'income') payload.income += tx.amount;
      if (tx.type === 'expense') {
        payload.expense += tx.amount;
        payload.categories[tx.categoryId] = (payload.categories[tx.categoryId] || 0) + tx.amount;
      }
    }
    return payload;
  }, [store, activeMonth]);

  const monthlyTopCategories = useMemo(() => {
    if (!store) return [];
    return Object.entries(monthly.categories)
      .map(([categoryId, amount]) => ({
        name: store.categories.find((c) => c.id === categoryId)?.name || 'Unknown',
        amount,
      }))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
      .slice(0, 5);
  }, [monthly.categories, store]);

  const categorySpend = useMemo(() => {
    if (!store) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    for (const tx of store.transactions) {
      if (tx.type === 'expense') map[tx.categoryId] = (map[tx.categoryId] || 0) + tx.amount;
    }
    return map;
  }, [store]);

  const vendorData = useMemo(() => {
    if (!store) return [] as { name: string; value: number }[];
    const map: Record<string, number> = {};
    for (const tx of store.transactions) {
      if (tx.type === 'expense') {
        const vendor = tx.vendor?.trim() || 'Manual Entry';
        map[vendor] = (map[vendor] || 0) + tx.amount;
      }
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      .slice(0, 10);
  }, [store]);

  const categoryData = useMemo(() => {
    if (!store) return [] as { name: string; value: number }[];
    return Object.entries(categorySpend)
      .map(([id, value]) => ({
        name: store.categories.find((c) => c.id === id)?.name || 'Unknown',
        value,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [categorySpend, store]);

  const sankeyData = useMemo(() => {
    if (!store) return { nodes: [], links: [] as { source: number; target: number; value: number }[] };

    const accountFlowTotals = new Map<string, number>();
    const expenseCategoryTotals = new Map<string, number>();

    for (const tx of store.transactions) {
      if (tx.type === 'income') {
        accountFlowTotals.set(tx.accountId, (accountFlowTotals.get(tx.accountId) || 0) + tx.amount);
      }
      if (tx.type === 'expense') {
        accountFlowTotals.set(tx.accountId, (accountFlowTotals.get(tx.accountId) || 0) + tx.amount);
        expenseCategoryTotals.set(tx.categoryId, (expenseCategoryTotals.get(tx.categoryId) || 0) + tx.amount);
      }
    }

    const sortedAccountIds = [...accountFlowTotals.entries()]
      .sort((a, b) => b[1] - a[1] || (store.accounts.find((x) => x.id === a[0])?.name || '').localeCompare(store.accounts.find((x) => x.id === b[0])?.name || ''))
      .map(([id]) => id);

    const sortedExpenseCategoryIds = [...expenseCategoryTotals.entries()]
      .sort((a, b) => b[1] - a[1] || (store.categories.find((x) => x.id === a[0])?.name || '').localeCompare(store.categories.find((x) => x.id === b[0])?.name || ''))
      .map(([id]) => id);

    const nodeNames = [
      'Income',
      ...sortedAccountIds.map((id) => store.accounts.find((a) => a.id === id)?.name || 'Unknown'),
      ...sortedExpenseCategoryIds.map((id) => store.categories.find((c) => c.id === id)?.name || 'Unknown'),
    ];

    const uniqueNames: string[] = [];
    for (const name of nodeNames) {
      if (!uniqueNames.includes(name)) uniqueNames.push(name);
    }

    const nodeIndex = new Map(uniqueNames.map((name, index) => [name, index]));
    const linkAgg = new Map<string, { source: number; target: number; value: number; sourceName: string; targetName: string }>();

    for (const tx of store.transactions) {
      if (tx.type === 'income') {
        const sourceName = 'Income';
        const targetName = store.accounts.find((a) => a.id === tx.accountId)?.name || 'Unknown';
        const source = nodeIndex.get(sourceName)!;
        const target = nodeIndex.get(targetName)!;
        const key = `${source}->${target}`;
        const existing = linkAgg.get(key);
        if (existing) existing.value += tx.amount;
        else linkAgg.set(key, { source, target, value: tx.amount, sourceName, targetName });
      }
      if (tx.type === 'expense') {
        const sourceName = store.accounts.find((a) => a.id === tx.accountId)?.name || 'Unknown';
        const targetName = store.categories.find((c) => c.id === tx.categoryId)?.name || 'Unknown';
        const source = nodeIndex.get(sourceName)!;
        const target = nodeIndex.get(targetName)!;
        const key = `${source}->${target}`;
        const existing = linkAgg.get(key);
        if (existing) existing.value += tx.amount;
        else linkAgg.set(key, { source, target, value: tx.amount, sourceName, targetName });
      }
    }

    const links = [...linkAgg.values()]
      .sort((a, b) => b.value - a.value || a.sourceName.localeCompare(b.sourceName) || a.targetName.localeCompare(b.targetName))
      .map(({ source, target, value }) => ({ source, target, value }));

    return {
      nodes: uniqueNames.map((name) => ({ name })),
      links,
    };
  }, [store]);

  const saveTransaction = () => {
    if (!store) return;

    setTxError('');
    const amount = Number(draft.amount);

    if (!draft.date) {
      setTxError('Date is required.');
      return;
    }

    if (Number.isNaN(amount) || amount <= 0) {
      setTxError('Amount must be greater than zero.');
      return;
    }

    let tx: Transaction | null = null;

    if (draft.type === 'transfer') {
      if (!draft.fromAccountId || !draft.toAccountId || draft.fromAccountId === draft.toAccountId) {
        setTxError('Transfer must include different from/to accounts.');
        return;
      }

      tx = {
        id: editingId || uid(),
        type: 'transfer',
        amount,
        date: draft.date,
        vendor: draft.vendor.trim(),
        fromAccountId: draft.fromAccountId,
        toAccountId: draft.toAccountId,
      };
    } else {
      if (!draft.vendor.trim() || !draft.accountId || !draft.categoryId) {
        setTxError('Vendor, Account, and Category are required for income/expense.');
        return;
      }

      tx = {
        id: editingId || uid(),
        type: draft.type,
        amount,
        date: draft.date,
        vendor: draft.vendor.trim(),
        accountId: draft.accountId,
        categoryId: draft.categoryId,
      };
    }

    setStore((prev) =>
      prev
        ? {
            ...prev,
            transactions: editingId
              ? prev.transactions.map((item) => (item.id === editingId ? tx! : item))
              : [tx!, ...prev.transactions],
          }
        : prev,
    );
    setEditingId(null);
    setDraft(defaultDraft());
  };

  if (!store) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
        <h1 className="text-3xl font-semibold tracking-tight">WealthFlow</h1>
        <p className="mt-3 text-sm text-zinc-400">Loading data…</p>
      </div>
    );
  }

  const deleteAccountTxCount = deleteAccountId
    ? store.transactions.filter((tx) =>
        tx.type === 'transfer'
          ? tx.fromAccountId === deleteAccountId || tx.toAccountId === deleteAccountId
          : tx.accountId === deleteAccountId,
      ).length
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">WealthFlow</h1>
        <p className="text-zinc-400">Privacy-first manual ledger · schema v{store.schemaVersion}</p>
        {loadWarning ? <p className="mt-2 text-xs text-amber-300">{loadWarning}</p> : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-12">
        <AccountsPanel
          accounts={store.accounts}
          balances={balances}
          onCreate={(name) =>
            name.trim() &&
            setStore((prev) =>
              prev ? { ...prev, accounts: [...prev.accounts, { id: uid(), name: name.trim() }] } : prev,
            )
          }
          onRename={(id, name) =>
            name.trim() &&
            setStore((prev) =>
              prev
                ? {
                    ...prev,
                    accounts: prev.accounts.map((a) => (a.id === id ? { ...a, name: name.trim() } : a)),
                  }
                : prev,
            )
          }
          onDeleteRequest={(id) => setDeleteAccountId(id)}
          onToggleArchive={(id) =>
            setStore((prev) =>
              prev
                ? {
                    ...prev,
                    accounts: prev.accounts.map((a) => (a.id === id ? { ...a, archived: !a.archived } : a)),
                  }
                : prev,
            )
          }
        />

        <CategoriesPanel
          categories={store.categories}
          onCreate={(name, group) =>
            name.trim() &&
            setStore((prev) =>
              prev
                ? {
                    ...prev,
                    categories: [...prev.categories, { id: uid(), name: name.trim(), group }],
                  }
                : prev,
            )
          }
          onRename={(id, name) =>
            name.trim() &&
            setStore((prev) =>
              prev
                ? {
                    ...prev,
                    categories: prev.categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)),
                  }
                : prev,
            )
          }
          onDelete={(id, replacementId) =>
            setStore((prev) =>
              prev
                ? {
                    ...prev,
                    categories: prev.categories.filter((c) => c.id !== id),
                    budgets: prev.budgets.map((b) =>
                      b.categoryId === id ? { ...b, categoryId: replacementId } : b,
                    ),
                    transactions: prev.transactions.map((t) =>
                      t.type === 'transfer' ? t : t.categoryId === id ? { ...t, categoryId: replacementId } : t,
                    ),
                  }
                : prev,
            )
          }
        />

        <BudgetsPanel
          budgets={store.budgets}
          categories={store.categories}
          categorySpend={categorySpend}
          onCreate={(categoryId, limit) =>
            setStore((prev) =>
              prev ? { ...prev, budgets: [...prev.budgets, { id: uid(), categoryId, limit }] } : prev,
            )
          }
        />

        <TransactionForm
          draft={draft}
          setDraft={setDraft}
          editingId={editingId}
          accounts={store.accounts.filter((a) => !a.archived)}
          categories={store.categories}
          suggestions={suggestions}
          onSubmit={saveTransaction}
          error={txError}
        />

        <LedgerPanel
          transactions={store.transactions}
          accounts={store.accounts}
          categories={store.categories}
          visibleCount={visibleCount}
          onLoadMore={() => setVisibleCount((c) => c + PAGE_SIZE)}
          onEdit={(tx) => {
            setEditingId(tx.id);
            setDraft(toDraft(tx));
            setTxError('');
          }}
          onDelete={(id) =>
            setStore((prev) =>
              prev ? { ...prev, transactions: prev.transactions.filter((t) => t.id !== id) } : prev,
            )
          }
        />

        <MonthlySnapshotPanel
          months={months}
          activeMonth={activeMonth}
          setActiveMonth={setActiveMonth}
          income={monthly.income}
          expense={monthly.expense}
          topCategories={monthlyTopCategories}
        />

        <SettingsPanel
          onExport={() => {
            const blob = exportStoreBlob(store);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `wealthflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          onImport={(file) => {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const parsed = JSON.parse(String(reader.result || '{}'));
                const incoming = parsed.store ?? parsed;
                const error = validateImportedStore(incoming);
                if (error) {
                  alert(error);
                  return;
                }
                if (!confirm('Replace all local data with imported backup?')) return;
                const migrated = migrateStore(incoming);
                resetStore().then(() => setStore(migrated));
              } catch {
                alert('Import failed: invalid JSON file.');
              }
            };
            reader.readAsText(file);
          }}
        />

        <AnalyticsPanel sankeyData={sankeyData} vendorData={vendorData} categoryData={categoryData} />
      </div>

      {deleteAccountId ? (
        <ConfirmModal title="Delete account" onClose={() => setDeleteAccountId(null)}>
          <p className="mb-3 text-sm text-zinc-300">
            This account has <strong>{deleteAccountTxCount}</strong> linked transactions.
            Reassign those transactions before deleting to preserve ledger integrity.
          </p>
          <select className="input" value={reassignAccountId} onChange={(e) => setReassignAccountId(e.target.value)}>
            <option value="">Reassign to account...</option>
            {store.accounts
              .filter((a) => a.id !== deleteAccountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
          <div className="mt-3 flex justify-end gap-2">
            <button className="icon-btn" onClick={() => setDeleteAccountId(null)}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={() => {
                if (!deleteAccountId) return;
                if (deleteAccountTxCount > 0 && !reassignAccountId) return;
                setStore((prev) =>
                  prev
                    ? {
                        ...prev,
                        accounts: prev.accounts.filter((a) => a.id !== deleteAccountId),
                        transactions: prev.transactions.map((tx) => {
                          if (tx.type === 'transfer') {
                            return {
                              ...tx,
                              fromAccountId:
                                tx.fromAccountId === deleteAccountId ? reassignAccountId : tx.fromAccountId,
                              toAccountId:
                                tx.toAccountId === deleteAccountId ? reassignAccountId : tx.toAccountId,
                            };
                          }
                          return tx.accountId === deleteAccountId
                            ? { ...tx, accountId: reassignAccountId }
                            : tx;
                        }),
                      }
                    : prev,
                );
                setDeleteAccountId(null);
                setReassignAccountId('');
              }}
            >
              Reassign + Delete
            </button>
          </div>
        </ConfirmModal>
      ) : null}
    </div>
  );
};
