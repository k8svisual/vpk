import { useCallback, useEffect, useState, type MouseEvent, type CSSProperties } from 'react';
import { SearchView } from './SearchView';
import { NetworkView } from './NetworkView';
import { SecurityView } from './SecurityView';
import { StorageView } from './StorageView';
import { SchematicView } from './SchematicView';
import { ContainerImagesView } from './ContainerImagesView';

interface Snapshots {
  dir: string;
  current: string;
  files: string[];
}

type ViewId = 'ownerref' | 'search' | 'network' | 'security' | 'storage' | 'schematic' | 'images';
const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'ownerref', label: 'OwnerRef' },
  { id: 'search', label: 'Search' },
  { id: 'network', label: 'Network' },
  { id: 'security', label: 'Security' },
  { id: 'storage', label: 'Storage' },
  { id: 'schematic', label: 'Schematic' },
  { id: 'images', label: 'Images' },
];

export function App() {
  const [view, setView] = useState<ViewId>('ownerref');
  const [snaps, setSnaps] = useState<Snapshots>({ dir: '', current: '', files: [] });
  const [ns, setNs] = useState('kube-system');
  const [svg, setSvg] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [definition, setDefinition] = useState('');
  const [busy, setBusy] = useState<string>('');

  const loadGraph = useCallback((namespace: string) => {
    fetch(`/ownerref?ns=${encodeURIComponent(namespace)}`)
      .then((r) => r.text())
      .then(setSvg)
      .catch((e: unknown) => setSvg(`<p style="padding:12px">failed: ${String(e)}</p>`));
  }, []);

  const refreshSnaps = useCallback(
    () => fetch('/snapshots').then((r) => r.json() as Promise<Snapshots>).then(setSnaps),
    [],
  );

  useEffect(() => {
    void refreshSnaps();
    loadGraph(ns);
  }, [loadGraph, refreshSnaps, ns]);

  async function post(path: string, body: unknown) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  async function onSelectSnapshot(file: string) {
    setBusy('loading…');
    await post('/load', { path: file });
    await refreshSnaps();
    loadGraph(ns);
    setSelected(null);
    setDefinition('');
    setBusy('');
  }

  async function onCapture() {
    setBusy('capturing from cluster…');
    const res = (await post('/capture', {})) as { snapshot?: string; error?: string };
    await refreshSnaps();
    loadGraph(ns);
    setBusy(res.error ? `error: ${res.error}` : '');
  }

  function selectResource(id: string) {
    setSelected(id);
    setDefinition('loading…');
    fetch(`/definition?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((raw: unknown) => setDefinition(JSON.stringify(raw, null, 2)))
      .catch((err: unknown) => setDefinition(String(err)));
  }

  function onGraphClick(e: MouseEvent<HTMLDivElement>) {
    const node = (e.target as Element).closest('[data-resource-id]');
    const id = node?.getAttribute('data-resource-id');
    if (id) selectResource(id);
  }

  const label: CSSProperties = { fontSize: 13, color: '#555' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <header
        style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #d0d0d0', flexWrap: 'wrap' }}
      >
        <strong>VpK</strong>
        <nav style={{ display: 'flex', gap: 4 }}>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              style={{
                padding: '4px 10px',
                border: '1px solid #d0d0d0',
                background: view === v.id ? '#333' : '#fff',
                color: view === v.id ? '#fff' : '#333',
                cursor: 'pointer',
              }}
            >
              {v.label}
            </button>
          ))}
        </nav>
        <label style={label}>
          snapshot{' '}
          <select value={snaps.current} onChange={(e) => void onSelectSnapshot(e.target.value)}>
            {snaps.files.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label style={label}>
          namespace{' '}
          <input value={ns} onChange={(e) => setNs(e.target.value)} onBlur={() => loadGraph(ns)} style={{ width: 140 }} />
        </label>
        <button onClick={() => void onCapture()} disabled={!!busy}>
          Capture from cluster
        </button>
        <span style={{ ...label, color: '#c0392b' }}>{busy}</span>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <main style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {view === 'ownerref' && <div onClick={onGraphClick} dangerouslySetInnerHTML={{ __html: svg }} />}
          {view === 'search' && <SearchView onSelect={selectResource} />}
          {view === 'network' && <NetworkView namespace={ns} onSelect={selectResource} />}
          {view === 'security' && <SecurityView onSelect={selectResource} />}
          {view === 'storage' && <StorageView onSelect={selectResource} />}
          {view === 'schematic' && <SchematicView podId={selected} onSelect={selectResource} />}
          {view === 'images' && <ContainerImagesView onSelect={selectResource} />}
        </main>
        <aside style={{ width: 460, borderLeft: '1px solid #d0d0d0', overflow: 'auto', padding: 12, background: '#f6f6f4' }}>
          <h3 style={{ marginTop: 4, fontWeight: 500 }}>{selected ? 'Definition' : 'Click a node'}</h3>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{definition}</pre>
        </aside>
      </div>
    </div>
  );
}
