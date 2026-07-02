import { useEffect, useState, type MouseEvent } from 'react';

/** M1 walking skeleton: fetch the ownerRef SVG, click a node → fetch + show its definition. */
export function App() {
  const ns = 'kube-system';
  const [svg, setSvg] = useState('<p style="padding:12px">loading…</p>');
  const [selected, setSelected] = useState<string | null>(null);
  const [definition, setDefinition] = useState('');

  useEffect(() => {
    fetch(`/ownerref?ns=${encodeURIComponent(ns)}`)
      .then((r) => r.text())
      .then(setSvg)
      .catch((e: unknown) => setSvg(`<p style="padding:12px">failed to load: ${String(e)}</p>`));
  }, [ns]);

  function onGraphClick(e: MouseEvent<HTMLDivElement>) {
    const node = (e.target as Element).closest('[data-resource-id]');
    const id = node?.getAttribute('data-resource-id');
    if (!id) return;
    setSelected(id);
    setDefinition('loading…');
    fetch(`/definition?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((raw: unknown) => setDefinition(JSON.stringify(raw, null, 2)))
      .catch((err: unknown) => setDefinition(String(err)));
  }

  return (
    <div style={{ display: 'flex', height: '100vh', margin: 0, fontFamily: 'system-ui, sans-serif' }}>
      <main style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        <h2 style={{ margin: '4px 0 12px', fontWeight: 500 }}>VpK — owner references · {ns}</h2>
        <div onClick={onGraphClick} dangerouslySetInnerHTML={{ __html: svg }} />
      </main>
      <aside
        style={{
          width: 460,
          borderLeft: '1px solid #d0d0d0',
          overflow: 'auto',
          padding: 12,
          background: '#f6f6f4',
        }}
      >
        <h3 style={{ marginTop: 4, fontWeight: 500 }}>{selected ? 'Definition' : 'Click a node'}</h3>
        <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{definition}</pre>
      </aside>
    </div>
  );
}
