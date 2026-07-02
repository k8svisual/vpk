import { useEffect, useState, type MouseEvent } from 'react';

/**
 * Renders the server-generated schematic SVG (packages/server/src/render/schematicSvg.ts) — matches the
 * OwnerRef view's pattern: fetch SVG text, inline it, delegate clicks on data-resource-id up to the shared
 * selection bus. Replaces an earlier HTML/React card MVP (DESIGN §6.9 calls for real server-SVG rendering).
 */
export function SchematicView({ podId, onSelect }: { podId: string | null; onSelect: (id: string) => void }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!podId) {
      setSvg('');
      setError('');
      return;
    }
    fetch(`/schematic.svg?id=${encodeURIComponent(podId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('not found (not a Pod id in this snapshot)');
        return r.text();
      })
      .then((text) => {
        setSvg(text);
        setError('');
      })
      .catch((e: unknown) => {
        setSvg('');
        setError(String(e));
      });
  }, [podId]);

  function onClick(e: MouseEvent<HTMLDivElement>) {
    const node = (e.target as Element).closest('[data-resource-id]');
    const id = node?.getAttribute('data-resource-id');
    if (id) onSelect(id);
  }

  if (!podId) return <p className="text-sm" style={{ color: 'var(--vpk-fg-muted)' }}>Select a Pod (e.g. from Search) to view its schematic.</p>;
  if (error) return <p className="text-sm" style={{ color: 'var(--vpk-status-error)' }}>{error}</p>;
  if (!svg) return <p className="text-sm" style={{ color: 'var(--vpk-fg-muted)' }}>loading…</p>;

  return <div onClick={onClick} dangerouslySetInnerHTML={{ __html: svg }} />;
}
