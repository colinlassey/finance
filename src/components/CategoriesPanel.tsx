import { Tag, Plus, Trash2, Pencil } from 'lucide-react';
import { useState } from 'react';
import type { Category, CategoryGroup } from '../models/types';

type Props = {
  categories: Category[];
  onCreate: (name: string, group: CategoryGroup) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, replacementId: string) => void;
};

export const CategoriesPanel = ({ categories, onCreate, onRename, onDelete }: Props) => {
  const [name, setName] = useState('');
  const [group, setGroup] = useState<CategoryGroup>('Expense');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [replacementById, setReplacementById] = useState<Record<string, string>>({});

  return (
    <section className="card lg:col-span-4">
      <h2 className="section-title"><Tag size={16} /> Categories</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <input className="input col-span-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" />
        <select className="input" value={group} onChange={(e) => setGroup(e.target.value as CategoryGroup)}>
          <option>Expense</option>
          <option>Income</option>
        </select>
      </div>
      <button className="btn mt-2 w-full" onClick={() => { onCreate(name, group); setName(''); }}><Plus size={14} /> Add</button>

      <div className="mt-4 space-y-2">
        {categories.map((c) => (
          <div className="row" key={c.id}>
            <div className="flex-1">
              {editingId === c.id ? (
                <div className="flex gap-2">
                  <input className="input" value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} />
                  <button className="icon-btn" onClick={() => { onRename(c.id, renameDraft); setEditingId(null); }}>Save</button>
                </div>
              ) : (
                <>
                  <div className="text-sm">{c.name}</div>
                  <div className="text-xs text-zinc-500">{c.group || 'Expense'}</div>
                </>
              )}
            </div>
            <button className="icon-btn" onClick={() => { setEditingId(c.id); setRenameDraft(c.name); }}><Pencil size={14} /></button>
            <select
              className="input max-w-36"
              value={replacementById[c.id] || ''}
              onChange={(e) => setReplacementById((prev) => ({ ...prev, [c.id]: e.target.value }))}
            >
              <option value="">Reassign to…</option>
              {categories.filter((x) => x.id !== c.id).map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}
            </select>
            <button className="icon-btn" onClick={() => replacementById[c.id] && onDelete(c.id, replacementById[c.id])}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  );
};
