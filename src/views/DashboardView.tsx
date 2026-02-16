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
import { monthKey } from '../lib/date';
import { uid } from '../lib/uid';
import { getVendorSuggestions } from '../lib/suggestions';
import { deriveAccountBalances } from '../models/ledger';
import type { Transaction, TxType, WealthFlowStore } from '../models/types';
import { exportStoreBlob, loadStore, saveStore, validateImportedStore } from '../storage/store';
import { migrateStore } from '../storage/migrations';

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

export const DashboardView = () => {
  const [store, setStore] = useState<WealthFlowStore>(() => loadStore());
  const [draft, setDraft] = useState<Draft>(defaultDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState('');
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [reassignAccountId, setReassignAccountId] = useState('');

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const balances = useMemo(() => deriveAccountBalances(store.transactions), [store.transactions]);

  const suggestions = useMemo(
    () => getVendorSuggestions(store.transactions, draft.vendor),
    [store.transactions, draft.vendor],
  );

  const months = useMemo(
    () => [...new Set(store.transactions.map((t) => monthKey(t.date)))].sort().reverse(),
    [store.transactions],
  );

  useEffect(() => {
    if (!activeMonth && months[0]) setActiveMonth(months[0]);
  }, [months, activeMonth]);

  useEffect(() => {
    if (!draft.accountId && store.accounts[0]) {
      setDraft((d) => ({ ...d, accountId: store.accounts[0].id, fromAccountId: store.accounts[0].id }));
    }
  }, [draft.accountId, store.accounts]);

  const monthly = useMemo(() => {
    const payload = { income: 0, expense: 0 };
    for (const tx of store.transactions) {
      if (monthKey(tx.date) !== activeMonth) continue;
      if (tx.type === 'income') payload.income += tx.amount;
      if (tx.type === 'expense') payload.expense += tx.amount;
    }
    return payload;
  }, [store.transactions, activeMonth]);

  const categorySpend = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of store.transactions) {
      if (tx.type === 'expense') map[tx.categoryId] = (map[tx.categoryId] || 0) + tx.amount;
    }
    return map;
  }, [store.transactions]);

  const vendorData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of store.transactions) {
      if (tx.type === 'expense') map[tx.vendor || 'Manual Entry'] = (map[tx.vendor || 'Manual Entry'] || 0) + tx.amount;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [store.transactions]);

  const categoryData = useMemo(
    () => Object.entries(categorySpend).map(([id, value]) => ({
      name: store.categories.find((c) => c.id === id)?.name || 'Unknown',
      value,
    })),
    [categorySpend, store.categories],
  );

  const sankeyData = useMemo(() => {
    const nodeIndex = new Map<string, number>();
    const nodes: { name: string }[] = [];
    const links: { source: number; target: number; value: number }[] = [];
    const linkMap = new Map<string, number>();

    const ensureNode = (name: string) => {
      if (nodeIndex.has(name)) return nodeIndex.get(name)!;
      const i = nodes.length;
      nodeIndex.set(name, i);
      nodes.push({ name });
      return i;
    };

    for (const tx of store.transactions) {
      if (tx.type === 'income') {
        const from = ensureNode('Income');
        const to = ensureNode(store.accounts.find((a) => a.id === tx.accountId)?.name || 'Unknown');
        const key = `${from}-${to}`;
        const existing = linkMap.get(key);
        if (existing !== undefined) links[existing].value += tx.amount;
        else {
          linkMap.set(key, links.length);
          links.push({ source: from, target: to, value: tx.amount });
        }
      }
      if (tx.type === 'expense') {
        const from = ensureNode(store.accounts.find((a) => a.id === tx.accountId)?.name || 'Unknown');
        const to = ensureNode(store.categories.find((c) => c.id === tx.categoryId)?.name || 'Unknown');
        const key = `${from}-${to}`;
        const existing = linkMap.get(key);
        if (existing !== undefined) links[existing].value += tx.amount;
        else {
          linkMap.set(key, links.length);
          links.push({ source: from, target: to, value: tx.amount });
        }
      }
      if (tx.type === 'transfer') {
        const from = ensureNode(store.accounts.find((a) => a.id === tx.fromAccountId)?.name || 'Unknown');
        const to = ensureNode(store.accounts.find((a) => a.id === tx.toAccountId)?.name || 'Unknown');
        const key = `${from}-${to}`;
        const existing = linkMap.get(key);
        if (existing !== undefined) links[existing].value += tx.amount;
        else {
          linkMap.set(key, links.length);
          links.push({ source: from, target: to, value: tx.amount });
        }
      }
    }

    links.sort((a, b) => b.value - a.value);
    return { nodes, links };
  }, [store.accounts, store.categories, store.transactions]);

  const saveTransaction = () => {
    const amount = Number(draft.amount);
    if (Number.isNaN(amount) || amount <= 0) return;

    let tx: Transaction | null = null;
    if (draft.type === 'transfer') {
      if (!draft.fromAccountId || !draft.toAccountId || draft.fromAccountId === draft.toAccountId) return;
      tx = {
        id: editingId || uid(),
        type: 'transfer',
        amount,
        date: draft.date,
        vendor: draft.vendor,
        fromAccountId: draft.fromAccountId,
        toAccountId: draft.toAccountId,
      };
    } else {
      if (!draft.accountId || !draft.categoryId) return;
      tx = {
        id: editingId || uid(),
        type: draft.type,
        amount,
        date: draft.date,
        vendor: draft.vendor,
        accountId: draft.accountId,
        categoryId: draft.categoryId,
      };
    }

    setStore((prev) => ({
      ...prev,
      transactions: editingId
        ? prev.transactions.map((item) => (item.id === editingId ? tx! : item))
        : [tx!, ...prev.transactions],
    }));
    setEditingId(null);
    setDraft(defaultDraft());
  };

  const deleteAccountTxCount = deleteAccountId
    ? store.transactions.filter((tx) => (tx.type === 'transfer'
      ? tx.fromAccountId === deleteAccountId || tx.toAccountId === deleteAccountId
      : tx.accountId === deleteAccountId)).length
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">WealthFlow</h1>
        <p className="text-zinc-400">Privacy-first manual ledger · schema v{store.schemaVersion}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-12">
        <AccountsPanel
          accounts={store.accounts}
          balances={balances}
          onCreate={(name) => name.trim() && setStore((prev) => ({ ...prev, accounts: [...prev.accounts, { id: uid(), name: name.trim() }] }))}
          onRename={(id, name) => name.trim() && setStore((prev) => ({ ...prev, accounts: prev.accounts.map((a) => a.id === id ? { ...a, name: name.trim() } : a) }))}
          onDeleteRequest={(id) => setDeleteAccountId(id)}
          onToggleArchive={(id) => setStore((prev) => ({ ...prev, accounts: prev.accounts.map((a) => a.id === id ? { ...a, archived: !a.archived } : a) }))}
        />

        <BudgetsPanel
          budgets={store.budgets}
          categories={store.categories}
          categorySpend={categorySpend}
          onCreate={(categoryId, limit) => setStore((prev) => ({ ...prev, budgets: [...prev.budgets, { id: uid(), categoryId, limit }] }))}
        />

        <TransactionForm
          draft={draft}
          setDraft={setDraft}
          editingId={editingId}
          accounts={store.accounts.filter((a) => !a.archived)}
          categories={store.categories}
          suggestions={suggestions}
          onSubmit={saveTransaction}
        />

        <LedgerPanel
          transactions={store.transactions}
          accounts={store.accounts}
          categories={store.categories}
          onEdit={(tx) => { setEditingId(tx.id); setDraft(toDraft(tx)); }}
          onDelete={(id) => setStore((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }))}
        />

        <MonthlySnapshotPanel
          months={months}
          activeMonth={activeMonth}
          setActiveMonth={setActiveMonth}
          income={monthly.income}
          expense={monthly.expense}
        />

        <CategoriesPanel
          categories={store.categories}
          onCreate={(name, group) => name.trim() && setStore((prev) => ({ ...prev, categories: [...prev.categories, { id: uid(), name: name.trim(), group }] }))}
          onRename={(id, name) => setStore((prev) => ({ ...prev, categories: prev.categories.map((c) => c.id === id ? { ...c, name } : c) }))}
          onDelete={(id, replacementId) => setStore((prev) => ({
            ...prev,
            categories: prev.categories.filter((c) => c.id !== id),
            budgets: prev.budgets.map((b) => b.categoryId === id ? { ...b, categoryId: replacementId } : b),
            transactions: prev.transactions.map((t) => (t.type === 'transfer' ? t : (t.categoryId === id ? { ...t, categoryId: replacementId } : t))),
          }))}
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
                const next = migrateStore(incoming);
                setStore(next);
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
            {store.accounts.filter((a) => a.id !== deleteAccountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="mt-3 flex justify-end gap-2">
            <button className="icon-btn" onClick={() => setDeleteAccountId(null)}>Cancel</button>
            <button
              className="btn"
              onClick={() => {
                if (!deleteAccountId) return;
                if (deleteAccountTxCount > 0 && !reassignAccountId) return;
                setStore((prev) => ({
                  ...prev,
                  accounts: prev.accounts.filter((a) => a.id !== deleteAccountId),
                  transactions: prev.transactions.map((tx) => {
                    if (tx.type === 'transfer') {
                      return {
                        ...tx,
                        fromAccountId: tx.fromAccountId === deleteAccountId ? reassignAccountId : tx.fromAccountId,
                        toAccountId: tx.toAccountId === deleteAccountId ? reassignAccountId : tx.toAccountId,
                      };
                    }
                    return tx.accountId === deleteAccountId ? { ...tx, accountId: reassignAccountId } : tx;
                  }),
                }));
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
