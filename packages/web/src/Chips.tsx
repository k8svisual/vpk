/** Shared "selected items" pill style for multi-select filter fields (Search's Kind/Namespace, Who Can's
 *  Verbs/Resources) — one look for "here's what you've picked" across the app. */
export const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  padding: '2px 6px 2px 8px',
  borderRadius: 999,
  border: '1px solid #b8c4d8',
  background: '#eef2f8',
  color: '#2a4266',
};

/** Renders `items` as removable pills below a text/select input. Nothing if the list is empty, so callers can
 *  render it unconditionally right after the input it belongs to. */
export function ChipList<T>({ items, label, onRemove }: { items: T[]; label: (t: T) => string; onRemove: (i: number) => void }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {items.map((it, i) => (
        <span key={label(it)} style={chip}>
          {label(it)}
          <button
            onClick={() => onRemove(i)}
            aria-label={`Remove ${label(it)}`}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6a7c96', fontSize: 13, lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
