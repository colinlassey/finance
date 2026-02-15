import type { ReactNode } from 'react';

type Props = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export const ConfirmModal = ({ title, children, onClose }: Props) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
    <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-medium">{title}</h3>
        <button className="icon-btn" onClick={onClose}>Close</button>
      </div>
      {children}
    </div>
  </div>
);
