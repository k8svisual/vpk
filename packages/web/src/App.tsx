import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { Share2, Search, LayoutTemplate, Network, Shield, Database, Layers, Box } from 'lucide-react';
import { NavRail, type RailGroup } from './NavRail';
import { SearchView } from './SearchView';
import { NetworkView } from './NetworkView';
import { SecurityView } from './SecurityView';
import { StorageView } from './StorageView';
import { SchematicView } from './SchematicView';
import { ContainerImagesView } from './ContainerImagesView';
import { Scene3D } from './Scene3D';
import { DefinitionModal } from './DefinitionModal';

interface Snapshots {
  dir: string;
  current: string;
  files: string[];
}

type ViewId = 'cluster3d' | 'ownerref' | 'search' | 'network' | 'security' | 'storage' | 'schematic' | 'images';

const RAIL_GROUPS: RailGroup<ViewId>[] = [
  {
    title: 'Cluster',
    items: [{ id: 'cluster3d', label: '3D Cluster', icon: Box }],
  },
  {
    title: 'Explore',
    items: [
      { id: 'search', label: 'Search', icon: Search },
      { id: 'ownerref', label: 'OwnerRef', icon: Share2 },
      { id: 'schematic', label: 'Schematic', icon: LayoutTemplate },
    ],
  },
  {
    title: 'Lenses',
    items: [
      { id: 'network', label: 'Network', icon: Network },
      { id: 'security', label: 'Security', icon: Shield },
      { id: 'storage', label: 'Storage', icon: Database },
      { id: 'images', label: 'Images', icon: Layers },
    ],
  },
];

export function App() {
  const [view, setView] = useState<ViewId>('ownerref');
  const [snaps, setSnaps] = useState<Snapshots>({ dir: '', current: '', files: [] });
  const [ns, setNs] = useState('kube-system');
  const [svg, setSvg] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
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
    setModalOpen(false);
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
    setModalOpen(true);
  }

  // 3D clicks show the small Properties popup first (matching the legacy app), not the full editor —
  // Scene3D opens the editor only when that popup's own "Open Editor" button is clicked.
  function select3D(id: string) {
    setSelected(id);
  }

  function onGraphClick(e: MouseEvent<HTMLDivElement>) {
    const node = (e.target as Element).closest('[data-resource-id]');
    const id = node?.getAttribute('data-resource-id');
    if (id) selectResource(id);
  }

  return (
    <div
      className="flex h-screen font-sans text-sm"
      style={{ background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
    >
      <NavRail groups={RAIL_GROUPS} active={view} onSelect={setView} />

      <div className="flex flex-1 flex-col min-w-0">
        <header
          className="flex items-center gap-3 border-b px-3 py-2 flex-wrap"
          style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-surface)' }}
        >
          <strong className="tracking-tight">VpK</strong>
          <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
            snapshot
            <select
              value={snaps.current}
              onChange={(e) => void onSelectSnapshot(e.target.value)}
              className="rounded border px-1 py-0.5"
              style={{ borderColor: 'var(--vpk-border)' }}
            >
              {snaps.files.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
            namespace
            <input
              value={ns}
              onChange={(e) => setNs(e.target.value)}
              onBlur={() => loadGraph(ns)}
              className="w-36 rounded border px-1.5 py-0.5"
              style={{ borderColor: 'var(--vpk-border)' }}
            />
          </label>
          <button
            onClick={() => void onCapture()}
            disabled={!!busy}
            className="rounded border px-2 py-1 text-xs cursor-pointer disabled:cursor-default disabled:opacity-50"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            Capture from cluster
          </button>
          <span className="text-xs" style={{ color: 'var(--vpk-status-error)' }}>
            {busy}
          </span>
        </header>

        <div className="flex flex-1 min-h-0">
          <main className={`flex-1 overflow-auto ${view === 'cluster3d' ? '' : 'p-3'}`}>
            {/* Scene3D stays mounted (visibility toggle inside) so there's at most one WebGL context ever. */}
            <Scene3D
              active={view === 'cluster3d'}
              onSelect={select3D}
              selected={selected}
              onOpenEditor={() => setModalOpen(true)}
              onViewSchematic={() => setView('schematic')}
              snapshotKey={snaps.current}
            />
            {view === 'ownerref' && <div onClick={onGraphClick} dangerouslySetInnerHTML={{ __html: svg }} />}
            {view === 'search' && <SearchView onSelect={selectResource} />}
            {view === 'network' && <NetworkView namespace={ns} onSelect={selectResource} />}
            {view === 'security' && <SecurityView onSelect={selectResource} />}
            {view === 'storage' && <StorageView onSelect={selectResource} />}
            {view === 'schematic' && <SchematicView podId={selected} onSelect={selectResource} />}
            {view === 'images' && <ContainerImagesView onSelect={selectResource} />}
          </main>
        </div>
      </div>

      <DefinitionModal resourceId={modalOpen ? selected : null} onClose={() => setModalOpen(false)} />
    </div>
  );
}
