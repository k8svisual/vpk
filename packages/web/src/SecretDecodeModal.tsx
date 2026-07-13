import { useEffect, useState } from 'react';

interface DecodedRow {
  key: string;
  value: string;
}

/** A Secret's `.data` values are base64 in the raw object (and `.stringData`, when present, is already plain
 *  text) — this un-hides them for display. Decodes through `TextDecoder` (not a bare `atob`), which treats
 *  the bytes as Latin-1 and mangles any multibyte UTF-8 character (e.g. "café" round-trips as "cafÃ©") — a
 *  real risk for Secret values holding non-ASCII text (display names, i18n config, etc.). Deliberately does
 *  NOT special-case the redacted placeholder message: that text isn't valid base64, so `atob` throws on it
 *  and the catch below just shows it verbatim, which is already the right behavior (whether real Secret data
 *  was ever pulled is a capture-time/view-time setting this modal has no business second-guessing). */
function decodeValue(base64: string): string {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return base64;
  }
}

/** Opened from a Schematic Secret icon's "Decode" button (see ResourceListModal, or the single-item case in
 *  SchematicView) — fetches that Secret's real definition and shows each key's decoded value, rather than the
 *  base64 ciphertext-looking text `DefinitionModal`'s raw YAML view would show. */
export function SecretDecodeModal({
  resourceId,
  onClose,
  courseData = false,
}: {
  resourceId: string | null;
  onClose: () => void;
  /** Fetch from the isolated course-capture twin of /definition instead of the global graph — see
   *  DefinitionModal's own courseData doc comment. */
  courseData?: boolean;
}) {
  const [name, setName] = useState('');
  const [rows, setRows] = useState<DecodedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resourceId) return;
    setRows(null);
    setError(null);
    // Guards against a slower response for a PREVIOUS resourceId landing after a newer one has already
    // started (the modal has no `key={resourceId}` at its call site, so it can stay mounted across an id
    // change) — without this a stale response can overwrite the current Secret with the wrong one's data.
    let cancelled = false;
    // no-store: this endpoint's response depends on the live "Redact Secrets" setting, which can be toggled
    // between two fetches of the SAME id — a normally-cached GET would silently keep showing whichever
    // redacted/real state was current the first time this id was ever fetched.
    const url = courseData ? '/course/graphic/definition' : '/definition';
    fetch(`${url}?id=${encodeURIComponent(resourceId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((raw: unknown) => {
        if (cancelled) return;
        const obj = raw as { metadata?: { name?: string }; data?: Record<string, string>; stringData?: Record<string, string> };
        setName(obj.metadata?.name ?? resourceId);
        const decoded: DecodedRow[] = [
          ...Object.entries(obj.data ?? {}).map(([key, value]) => ({ key, value: decodeValue(value) })),
          ...Object.entries(obj.stringData ?? {}).map(([key, value]) => ({ key, value })),
        ];
        setRows(decoded);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [resourceId, courseData]);

  if (!resourceId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative max-h-[80vh] w-full max-w-2xl overflow-auto rounded border shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div
          className="sticky top-0 flex items-center justify-between border-b px-4 py-3"
          style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
        >
          <h2 className="truncate font-medium" style={{ color: 'var(--vpk-fg)' }}>
            Decoded: {name}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 cursor-pointer rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            Close
          </button>
        </div>
        <div className="p-3 text-xs">
          {error && <p style={{ color: 'var(--vpk-status-error)' }}>{error}</p>}
          {!error && !rows && <p style={{ color: 'var(--vpk-fg-muted)' }}>loading…</p>}
          {rows && rows.length === 0 && <p style={{ color: 'var(--vpk-fg-muted)' }}>No data.</p>}
          {rows?.map((row) => (
            <div key={row.key} className="mb-2 border-b pb-2" style={{ borderColor: 'var(--vpk-border)' }}>
              <div className="font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
                {row.key}
              </div>
              <pre className="mt-0.5 overflow-x-auto break-all whitespace-pre-wrap" style={{ color: 'var(--vpk-fg)' }}>
                {row.value}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
