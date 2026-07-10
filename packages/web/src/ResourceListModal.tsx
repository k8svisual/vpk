export interface ResourceListItem {
  id: string;
  name: string;
}

/**
 * Clicking a Schematic aggregate icon ("secret (4)", "cm (7)") pops this — matching the legacy app's
 * "Resources" popup: one row per real item, a button (labeled with the Kind) to open its definition, and
 * (Secrets only) a second "Decode" button to view the base64-decoded value instead of raw ciphertext-looking
 * data. There's no single instance to jump straight to (the icon stands for the whole aggregate), so this is
 * the "show me all of them" step before picking one.
 */
export function ResourceListModal({
  kind,
  items,
  onOpenDefinition,
  onDecodeSecret,
  onClose,
}: {
  kind: string;
  items: ResourceListItem[];
  onOpenDefinition: (id: string) => void;
  /** Only provided when `kind === 'Secret'` — ConfigMaps and everything else have no encoded data to decode. */
  onDecodeSecret?: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative max-h-[80vh] w-full max-w-lg overflow-auto rounded border shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div
          className="sticky top-0 flex items-center justify-between border-b px-4 py-3"
          style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
        >
          <h2 className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
            Resources
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            Close
          </button>
        </div>
        <div className="p-3 text-xs">
          <div className="mb-1 grid grid-cols-[auto_1fr] gap-x-3 px-1 font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
            <span>Press to view</span>
            <span>Resource Name</span>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[auto_1fr] items-center gap-x-3 border-t px-1 py-1.5"
              style={{ borderColor: 'var(--vpk-border)' }}
            >
              <div className="flex gap-1.5">
                <button
                  onClick={() => onOpenDefinition(item.id)}
                  className="cursor-pointer rounded border px-2 py-1"
                  style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
                >
                  {kind}
                </button>
                {onDecodeSecret && (
                  <button
                    onClick={() => onDecodeSecret(item.id)}
                    className="cursor-pointer rounded border px-2 py-1"
                    style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
                  >
                    Decode
                  </button>
                )}
              </div>
              <span className="truncate" style={{ color: 'var(--vpk-fg)' }}>
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
