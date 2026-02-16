import { Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Account } from '../models/types';
import { formatCurrency } from '../lib/format';

type Props = {
  accounts: Account[];
  balances: Record<string, number>;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDeleteRequest: (id: string) => void;
  onToggleArchive: (id: string) => void;
};

export const AccountsPanel = ({
  accounts,
  balances,
  onCreate,
  onRename,
  onDeleteRequest,
  onToggleArchive,
}: Props) => {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <section className="card lg:col-span-4">
      <h2 className="section-title"><Landmark size={16} /> Accounts</h2>
      <div className="mt-3 flex gap-2">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Create account" />
        <button className="btn" onClick={() => { onCreate(name); setName(''); }}><Plus size={14} /></button>
      </div>
      <ul className="mt-4 space-y-2">
        {accounts.map((account) => (
          <li key={account.id} className="row gap-2">
            <div className="flex-1">
              {editing === account.id ? (
                <div className="flex gap-2">
                  <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <button className="icon-btn" onClick={() => { onRename(account.id, draft); setEditing(null); }}>Save</button>
                </div>
              ) : (
                <p>
                  {account.name} {account.archived ? <span className="text-xs text-zinc-500">(archived)</span> : null}
                </p>
              )}
              <strong>{formatCurrency(balances[account.id] || 0)}</strong>
            </div>
            <button className="icon-btn" onClick={() => { setEditing(account.id); setDraft(account.name); }}><Pencil size={14} /></button>
            <button className="icon-btn" onClick={() => onToggleArchive(account.id)}>{account.archived ? 'Unarchive' : 'Archive'}</button>
            <button className="icon-btn" onClick={() => onDeleteRequest(account.id)}><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
    </section>
  );
};
