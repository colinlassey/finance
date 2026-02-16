type Props = {
  onExport: () => void;
  onImport: (file: File) => void;
};

export const SettingsPanel = ({ onExport, onImport }: Props) => (
  <section className="card lg:col-span-4">
    <h2 className="section-title">Settings (Backup / Restore)</h2>
    <button className="btn mt-3 w-full" onClick={onExport}>Export JSON Backup</button>
    <label className="btn mt-2 block w-full cursor-pointer text-center">
      Import JSON Backup
      <input
        className="hidden"
        type="file"
        accept="application/json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
          e.currentTarget.value = '';
        }}
      />
    </label>
  </section>
);
