import { useState } from 'react';
import { ImportError, analyzeImport, applyImport, exportData, parseImport, type ExportFile, type ImportImpact } from '../../db/exportImport';
import { useApp } from '../AppContext';
import { WeightField } from '../components/Fields';
import { Modal } from '../components/Modal';

export function SettingsPage() {
  const app = useApp();
  const [pending, setPending] = useState<{ file: ExportFile; impact: ImportImpact } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [confirmed, setConfirmed] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const doExport = async () => {
    const data = await exportData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Export downloaded.');
    setError('');
  };

  const onFile = async (f: File | undefined) => {
    setMsg('');
    setError('');
    if (!f) return;
    try {
      const file = parseImport(await f.text());
      setPending({ file, impact: await analyzeImport(file) });
      setMode('merge');
      setConfirmed(false);
    } catch (e) {
      setError(e instanceof ImportError ? e.message : 'Could not read that file.');
    }
  };

  const apply = async () => {
    if (!pending) return;
    await applyImport(pending.file, mode);
    await app.reload();
    setPending(null);
    setMsg(`Import complete (${mode === 'replace' ? 'replaced all data' : 'merged'}).`);
  };

  const imp = pending?.impact;
  const danger = imp ? (mode === 'replace' ? imp.totalDeleted + (imp.settingsOverwritten ? 1 : 0) : imp.totalOverwritten) : 0;

  return (
    <section className="stack">
      <h1>Settings</h1>
      <div className="card stack">
        <div className="field">
          <span id="appearance-label">Appearance</span>
          <div className="seg" role="radiogroup" aria-labelledby="appearance-label">
            {([['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']] as const).map(([v, label]) => (
              <button
                key={v} type="button" role="radio" className={`chip ${(app.settings.theme ?? 'auto') === v ? 'on' : ''}`}
                aria-checked={(app.settings.theme ?? 'auto') === v} onClick={() => app.updateSettings({ theme: v })}
              >{label}</button>
            ))}
          </div>
          <small className="muted">Automatic follows your device's light or dark setting.</small>
        </div>
        <label className="field"><span>Weight units</span>
          <select value={app.settings.units} onChange={(e) => app.updateSettings({ units: e.target.value as 'lb' | 'kg' })}>
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </label>
        <WeightField label="Body weight" kg={app.settings.bodyweightKg} units={app.settings.units} onChange={(kg) => kg > 0 && app.updateSettings({ bodyweightKg: kg })} />
        <label className="field"><span>Rest time scale: {Math.round(app.settings.restScale * 100)}%</span>
          <input type="range" min={0.5} max={1.5} step={0.1} value={app.settings.restScale} onChange={(e) => app.updateSettings({ restScale: Number(e.target.value) })} aria-label="Rest time scale" />
        </label>
        <label className="check">
          <input
            type="checkbox" checked={!!app.settings.hiitAutoAdvance}
            onChange={(e) => app.updateSettings({ hiitAutoAdvance: e.target.checked })}
          />
          Auto-complete HIIT exercises when the work timer ends and move to the next
        </label>
      </div>
      <div className="card stack">
        <h2>Home</h2>
        <label className="check">
          <input
            type="checkbox" checked={!app.settings.welcomeDismissed}
            onChange={(e) => app.updateSettings({ welcomeDismissed: !e.target.checked })}
          />
          Show the welcome card on the Home dashboard
        </label>
      </div>
      <div className="card stack">
        <h2>Backup</h2>
        <p className="muted">All data lives in this browser's IndexedDB. Export regularly — clearing site data deletes it.</p>
        <div className="row wrap">
          <button type="button" onClick={doExport}>Export data</button>
          <label className="button">
            Import data
            <input type="file" accept="application/json,.json" className="sr-only" aria-label="Import file" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
        {msg && <p role="status" className="ok">{msg}</p>}
        {error && <p role="alert" className="error">{error}</p>}
      </div>
      {pending && imp && (
        <Modal title="Import data" onClose={() => setPending(null)}>
          <div className="stack">
            <p>Export file from {new Date(pending.file.exportedAt).toLocaleString()}.</p>
            <fieldset>
              <legend>How should this be imported?</legend>
              <label className="check"><input type="radio" name="mode" checked={mode === 'merge'} onChange={() => { setMode('merge'); setConfirmed(false); }} /> Merge — keep my existing data, imported items replace ones with the same ID</label>
              <label className="check"><input type="radio" name="mode" checked={mode === 'replace'} onChange={() => { setMode('replace'); setConfirmed(false); }} /> Replace everything — erase current data first</label>
            </fieldset>
            <table className="sets">
              <thead><tr><th>Data</th><th>Current</th><th>In file</th><th>{mode === 'replace' ? 'Deleted' : 'Overwritten'}</th></tr></thead>
              <tbody>
                {imp.stores.map((s) => (
                  <tr key={s.store}><td>{s.store}</td><td>{s.existing}</td><td>{s.incoming}</td><td>{mode === 'replace' ? s.deleted : s.overwritten}</td></tr>
                ))}
              </tbody>
            </table>
            <p className={danger ? 'warn' : 'muted'} role="alert">
              {mode === 'replace'
                ? `Warning: this permanently deletes ${imp.totalDeleted} existing records and replaces your settings.`
                : imp.totalOverwritten
                  ? `Warning: ${imp.totalOverwritten} existing records${imp.settingsOverwritten ? ' (including your settings)' : ''} will be overwritten.`
                  : 'No existing records will be overwritten.'}
            </p>
            {danger > 0 && (
              <label className="check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I understand existing data will be lost</label>
            )}
            <div className="row">
              <button type="button" className="primary" disabled={danger > 0 && !confirmed} onClick={apply}>Import</button>
              <button type="button" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
