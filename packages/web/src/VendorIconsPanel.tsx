import { useEffect, useMemo, useRef, useState } from 'react';
import type { VendorIconRule } from './vendorIcons';
import { setVendorIconOverrides, type VendorIconOverride } from './vendorIconOverrides';

/** One row of the review table — a built-in vendor mapping (optionally overridden/disabled) or a wholly
 *  user-added one. Derived fresh from `base` + `overrides` on every render rather than kept as its own state,
 *  so there's exactly one source of truth for "what does this needle currently resolve to." */
interface Row {
  needle: string;
  icon: string;
  title: string;
  isBuiltIn: boolean;
  isCustomized: boolean;
  isDisabled: boolean;
}

function buildRows(base: VendorIconRule[], overrides: VendorIconOverride[]): Row[] {
  const overrideByNeedle = new Map(overrides.map((o) => [o.needle, o]));
  const rows: Row[] = [];
  for (const b of base) {
    const o = overrideByNeedle.get(b.needle);
    if (o?.disabled) {
      rows.push({ needle: b.needle, icon: b.icon, title: o.title ?? b.title, isBuiltIn: true, isCustomized: false, isDisabled: true });
      continue;
    }
    rows.push({
      needle: b.needle,
      icon: o?.icon ?? b.icon,
      title: o?.title ?? b.title,
      isBuiltIn: true,
      isCustomized: !!o,
      isDisabled: false,
    });
  }
  const baseNeedles = new Set(base.map((b) => b.needle));
  for (const o of overrides) {
    if (baseNeedles.has(o.needle) || !o.icon) continue;
    rows.push({ needle: o.needle, icon: o.icon, title: o.title ?? o.needle, isBuiltIn: false, isCustomized: false, isDisabled: false });
  }
  return rows.sort((a, b) => a.title.localeCompare(b.title));
}

async function uploadIcon(file: File): Promise<string> {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const r = await fetch('/vendor-icons/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename: file.name, dataBase64 }),
  });
  const body = (await r.json()) as { path?: string; error?: string };
  if (!r.ok || !body.path) throw new Error(body.error ?? 'upload failed');
  return body.path;
}

/**
 * Settings > Vendor Icons — review every apiVersion -> icon mapping (built-in CNCF/vendor icons plus any
 * user overrides), replace a built-in icon with one of your own (uploaded straight to
 * `public/icons/custom/`, never overwriting the app-provided file — see vendorIconStore.ts's own doc comment
 * for why), remove a built-in mapping entirely, or add a brand-new vendor/apiVersion pairing. Every change
 * round-trips through the server (POST /vendor-icons) rather than localStorage, since @vpk/core's
 * schematicSvg/networkSvg/rbacSvg bake icon URLs into server-rendered SVG markup — a client-only override
 * could never reach that (see vendorIconOverrides.ts's doc comment for the full reasoning).
 */
export function VendorIconsPanel() {
  const [base, setBase] = useState<VendorIconRule[]>([]);
  const [overrides, setOverrides] = useState<VendorIconOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyNeedle, setBusyNeedle] = useState<string | null>(null);
  const fileInputs = useRef(new Map<string, HTMLInputElement | null>());

  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addNeedle, setAddNeedle] = useState('');
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  useEffect(() => {
    fetch('/vendor-icons')
      .then((r) => r.json() as Promise<{ base: VendorIconRule[]; overrides: VendorIconOverride[] }>)
      .then((d) => {
        setBase(d.base);
        setOverrides(d.overrides);
      })
      .catch(() => setError('Failed to load vendor icons'))
      .finally(() => setLoading(false));
  }, []);

  async function persist(next: VendorIconOverride[]) {
    setOverrides(next);
    setVendorIconOverrides(next); // instant, same as the color-override panels — next render/fetch picks it up
    const r = await fetch('/vendor-icons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (!r.ok) setError('Failed to save — change kept locally for this session only');
  }

  function upsertOverride(needle: string, patch: Partial<VendorIconOverride>) {
    const existing = overrides.find((o) => o.needle === needle);
    const next = existing
      ? overrides.map((o) => (o.needle === needle ? { ...o, ...patch } : o))
      : [...overrides, { needle, ...patch }];
    return persist(next);
  }

  async function replaceIcon(needle: string, file: File) {
    setBusyNeedle(needle);
    setError(null);
    try {
      const path = await uploadIcon(file);
      await upsertOverride(needle, { icon: path });
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusyNeedle(null);
    }
  }

  function resetOverride(needle: string) {
    return persist(overrides.filter((o) => o.needle !== needle));
  }

  function disableBuiltIn(needle: string, title: string) {
    return upsertOverride(needle, { disabled: true, title });
  }

  function deleteCustom(needle: string) {
    return persist(overrides.filter((o) => o.needle !== needle));
  }

  async function submitAdd() {
    if (!addNeedle.trim() || !addFile) {
      setError('A needle and an icon file are both required');
      return;
    }
    setAddBusy(true);
    setError(null);
    try {
      const path = await uploadIcon(addFile);
      const next = [...overrides, { needle: addNeedle.trim(), icon: path, title: addTitle.trim() || addNeedle.trim() }];
      await persist(next);
      setAddOpen(false);
      setAddTitle('');
      setAddNeedle('');
      setAddFile(null);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setAddBusy(false);
    }
  }

  const rows = useMemo(() => buildRows(base, overrides), [base, overrides]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(q) || r.needle.toLowerCase().includes(q));
  }, [rows, query]);

  if (loading) {
    return (
      <div className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
        loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <p style={{ color: 'var(--vpk-fg-muted)' }}>
        Icons shown for a resource whose Kind isn't a built-in Kubernetes type, matched by its apiVersion group
        (e.g. <code>cert-manager.io</code>). Replace any icon with your own, remove one, or add a brand-new
        vendor/apiVersion pairing — used in the Schematic, Resources, and editor views.
      </p>

      <div className="flex items-center justify-between gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by vendor or apiVersion…"
          className="flex-1 rounded border px-2 py-1"
          style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
        />
        <button
          onClick={() => setAddOpen((v) => !v)}
          className="shrink-0 cursor-pointer rounded border px-2 py-1"
          style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
        >
          {addOpen ? 'Cancel' : '+ Add new'}
        </button>
      </div>

      {addOpen && (
        <div className="flex flex-col gap-2 rounded border p-2" style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-bg)' }}>
          <div className="flex gap-2">
            <input
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder="Vendor/product name (e.g. Acme Corp)"
              className="flex-1 rounded border px-2 py-1"
              style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-surface)', color: 'var(--vpk-fg)' }}
            />
            <input
              value={addNeedle}
              onChange={(e) => setAddNeedle(e.target.value)}
              placeholder="apiVersion group substring (e.g. acme.example.com)"
              className="flex-1 rounded border px-2 py-1"
              style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-surface)', color: 'var(--vpk-fg)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="file" accept=".svg,.png,.jpg,.jpeg,.gif,.webp" onChange={(e) => setAddFile(e.target.files?.[0] ?? null)} className="flex-1 text-[11px]" />
            <button
              onClick={() => void submitAdd()}
              disabled={addBusy}
              className="cursor-pointer rounded border px-2 py-1 disabled:cursor-default disabled:opacity-50"
              style={{ borderColor: 'var(--vpk-accent)', color: 'var(--vpk-accent)' }}
            >
              {addBusy ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {error && <div style={{ color: 'var(--vpk-status-error)' }}>{error}</div>}

      <div className="flex flex-col gap-1 rounded border p-1" style={{ borderColor: 'var(--vpk-border)', maxHeight: 320, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div className="p-2" style={{ color: 'var(--vpk-fg-muted)' }}>
            No matches.
          </div>
        )}
        {filtered.map((row) => (
          <div
            key={row.needle}
            className="grid items-center gap-2 rounded px-1.5 py-1"
            style={{ gridTemplateColumns: '24px 1fr 1fr auto auto', opacity: row.isDisabled ? 0.5 : 1 }}
          >
            <img src={row.icon} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
            <span className="truncate" style={{ color: 'var(--vpk-fg)' }} title={row.title}>
              {row.title}
            </span>
            <span className="truncate font-mono text-[10px]" style={{ color: 'var(--vpk-fg-muted)' }} title={row.needle}>
              {row.needle}
            </span>
            <span className="text-[10px] uppercase" style={{ color: 'var(--vpk-fg-muted)' }}>
              {row.isDisabled ? 'removed' : row.isBuiltIn ? (row.isCustomized ? 'customized' : 'built-in') : 'custom'}
            </span>
            <div className="flex items-center gap-1 justify-self-end">
              <input
                ref={(el) => void fileInputs.current.set(row.needle, el)}
                type="file"
                accept=".svg,.png,.jpg,.jpeg,.gif,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void replaceIcon(row.needle, file);
                  e.target.value = '';
                }}
              />
              {!row.isDisabled && (
                <button
                  onClick={() => fileInputs.current.get(row.needle)?.click()}
                  disabled={busyNeedle === row.needle}
                  className="cursor-pointer rounded border px-1.5 py-0.5 text-[10px] disabled:cursor-default disabled:opacity-50"
                  style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
                >
                  {busyNeedle === row.needle ? '…' : 'Replace'}
                </button>
              )}
              {row.isBuiltIn && (row.isCustomized || row.isDisabled) && (
                <button
                  onClick={() => void resetOverride(row.needle)}
                  className="cursor-pointer rounded border px-1.5 py-0.5 text-[10px]"
                  style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
                >
                  Reset
                </button>
              )}
              {row.isBuiltIn && !row.isDisabled && (
                <button
                  onClick={() => void disableBuiltIn(row.needle, row.title)}
                  className="cursor-pointer rounded border px-1.5 py-0.5 text-[10px]"
                  style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
                >
                  Remove
                </button>
              )}
              {!row.isBuiltIn && (
                <button
                  onClick={() => void deleteCustom(row.needle)}
                  className="cursor-pointer rounded border px-1.5 py-0.5 text-[10px]"
                  style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
