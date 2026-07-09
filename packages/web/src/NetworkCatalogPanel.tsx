import { useEffect, useMemo, useState } from 'react';

/** Mirrors @vpk/core's CatalogEntry (networkInference.ts) minus its `overlay` resolver function, which the
 *  server strips before sending — a function can't cross the wire, and isn't user-editable anyway (see that
 *  file's NetworkCatalogOverride doc comment for why). */
interface CniBase {
  id: string;
  name: string;
  networkCrType?: string;
  daemonSets?: string[];
  crdGroups?: string[];
  annoPrefixes?: string[];
  namespaces?: string[];
  heuristic?: boolean;
}
interface CniOverride {
  id: string;
  name?: string;
  daemonSets?: string[];
  crdGroups?: string[];
  annoPrefixes?: string[];
  namespaces?: string[];
  disabled?: boolean;
}
interface MeshBase {
  id: string;
  name: string;
  crdGroups?: string[];
  deploys?: string[];
  daemonSets?: string[];
  sidecar?: string;
  namespaces?: string[];
}
interface MeshOverride {
  id: string;
  name?: string;
  crdGroups?: string[];
  deploys?: string[];
  daemonSets?: string[];
  sidecar?: string;
  namespaces?: string[];
  disabled?: boolean;
}

/** A single-string field (mesh's `sidecar`) or a comma-joined list field (everything else) — the edit form
 *  treats both as one text input, splitting/joining commas only for the list ones. */
type FieldSpec = { key: string; label: string; multi: boolean };

const CNI_FIELDS: FieldSpec[] = [
  { key: 'daemonSets', label: 'DaemonSet names', multi: true },
  { key: 'crdGroups', label: 'CRD groups', multi: true },
  { key: 'annoPrefixes', label: 'Node annotation prefixes', multi: true },
  { key: 'namespaces', label: 'Namespaces', multi: true },
];
const MESH_FIELDS: FieldSpec[] = [
  { key: 'daemonSets', label: 'DaemonSet names', multi: true },
  { key: 'crdGroups', label: 'CRD groups', multi: true },
  { key: 'deploys', label: 'Deployment names', multi: true },
  { key: 'sidecar', label: 'Sidecar container name', multi: false },
  { key: 'namespaces', label: 'Namespaces', multi: true },
];

interface Row {
  id: string;
  name: string;
  fields: Record<string, string[] | string | undefined>;
  isBuiltIn: boolean;
  isCustomized: boolean;
  isDisabled: boolean;
}

function buildRows<Base extends { id: string; name: string }, Override extends { id: string; name?: string; disabled?: boolean }>(
  base: Base[],
  overrides: Override[],
  fieldSpecs: FieldSpec[],
): Row[] {
  const overrideById = new Map(overrides.map((o) => [o.id, o]));
  const rows: Row[] = [];
  for (const b of base) {
    const o = overrideById.get(b.id) as (Override & Record<string, unknown>) | undefined;
    const fields: Row['fields'] = {};
    for (const f of fieldSpecs) fields[f.key] = (o?.[f.key] as string[] | string | undefined) ?? (b as unknown as Record<string, unknown>)[f.key] as string[] | string | undefined;
    rows.push({ id: b.id, name: o?.disabled ? (o.name ?? b.name) : (o?.name ?? b.name), fields, isBuiltIn: true, isCustomized: !!o && !o.disabled, isDisabled: !!o?.disabled });
  }
  const baseIds = new Set(base.map((b) => b.id));
  for (const o of overrides as (Override & Record<string, unknown>)[]) {
    if (baseIds.has(o.id) || o.disabled) continue;
    const fields: Row['fields'] = {};
    for (const f of fieldSpecs) fields[f.key] = o[f.key] as string[] | string | undefined;
    rows.push({ id: o.id, name: o.name ?? o.id, fields, isBuiltIn: false, isCustomized: false, isDisabled: false });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function fieldsSummary(fields: Row['fields'], specs: FieldSpec[]): string {
  return specs
    .map((f) => fields[f.key])
    .filter((v): v is string[] | string => !!v && (Array.isArray(v) ? v.length > 0 : true))
    .map((v) => (Array.isArray(v) ? v.join(', ') : v))
    .join(' · ');
}

/** One catalog (CNI or service mesh) — the two sections in the panel below share this exact same shape, just
 *  parameterized on which fields matter for that catalog. */
function CatalogSection<Base extends { id: string; name: string }, Override extends { id: string; name?: string; disabled?: boolean }>({
  title,
  hint,
  base,
  overrides,
  fieldSpecs,
  onSave,
}: {
  title: string;
  hint: string;
  base: Base[];
  overrides: Override[];
  fieldSpecs: FieldSpec[];
  onSave: (next: Override[]) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addId, setAddId] = useState('');
  const [addName, setAddName] = useState('');
  const [addValues, setAddValues] = useState<Record<string, string>>({});

  const rows = useMemo(() => buildRows(base, overrides, fieldSpecs), [base, overrides, fieldSpecs]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || fieldsSummary(r.fields, fieldSpecs).toLowerCase().includes(q));
  }, [rows, query, fieldSpecs]);

  function upsert(id: string, patch: Partial<Override>) {
    const existing = overrides.find((o) => o.id === id);
    const next = existing ? overrides.map((o) => (o.id === id ? { ...o, ...patch } : o)) : [...overrides, { id, ...patch } as Override];
    return onSave(next);
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setEditName(row.name);
    const vals: Record<string, string> = {};
    for (const f of fieldSpecs) {
      const v = row.fields[f.key];
      vals[f.key] = Array.isArray(v) ? v.join(', ') : (v ?? '');
    }
    setEditValues(vals);
  }

  function parseField(spec: FieldSpec, raw: string): string[] | string | undefined {
    if (!spec.multi) return raw.trim() || undefined;
    const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return list.length ? list : undefined;
  }

  async function saveEdit() {
    if (!editingId) return;
    const patch: Record<string, unknown> = { name: editName.trim() || editingId };
    for (const f of fieldSpecs) patch[f.key] = parseField(f, editValues[f.key] ?? '');
    await upsert(editingId, patch as Partial<Override>);
    setEditingId(null);
  }

  async function submitAdd() {
    if (!addId.trim()) return;
    const patch: Record<string, unknown> = { name: addName.trim() || addId.trim() };
    for (const f of fieldSpecs) patch[f.key] = parseField(f, addValues[f.key] ?? '');
    const next = [...overrides, { id: addId.trim(), ...patch } as Override];
    await onSave(next);
    setAddOpen(false);
    setAddId('');
    setAddName('');
    setAddValues({});
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
          {title}
        </span>
        <button
          onClick={() => setAddOpen((v) => !v)}
          className="cursor-pointer rounded border px-2 py-0.5 text-[11px]"
          style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
        >
          {addOpen ? 'Cancel' : '+ Add new'}
        </button>
      </div>
      <p style={{ color: 'var(--vpk-fg-muted)' }}>{hint}</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter…"
        className="rounded border px-2 py-1"
        style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
      />

      {addOpen && (
        <div className="flex flex-col gap-1.5 rounded border p-2" style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-bg)' }}>
          <div className="flex gap-2">
            <input
              value={addId}
              onChange={(e) => setAddId(e.target.value)}
              placeholder="id (e.g. acme-cni)"
              className="w-1/3 rounded border px-2 py-1"
              style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-surface)', color: 'var(--vpk-fg)' }}
            />
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Display name"
              className="flex-1 rounded border px-2 py-1"
              style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-surface)', color: 'var(--vpk-fg)' }}
            />
          </div>
          {fieldSpecs.map((f) => (
            <input
              key={f.key}
              value={addValues[f.key] ?? ''}
              onChange={(e) => setAddValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.multi ? `${f.label} (comma-separated)` : f.label}
              className="rounded border px-2 py-1"
              style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-surface)', color: 'var(--vpk-fg)' }}
            />
          ))}
          <button
            onClick={() => void submitAdd()}
            disabled={!addId.trim()}
            className="cursor-pointer self-start rounded border px-2 py-1 disabled:cursor-default disabled:opacity-50"
            style={{ borderColor: 'var(--vpk-accent)', color: 'var(--vpk-accent)' }}
          >
            Add
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1 rounded border p-1" style={{ borderColor: 'var(--vpk-border)', maxHeight: 220, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div className="p-2" style={{ color: 'var(--vpk-fg-muted)' }}>
            No matches.
          </div>
        )}
        {filtered.map((row) =>
          editingId === row.id ? (
            <div key={row.id} className="flex flex-col gap-1.5 rounded border p-2" style={{ borderColor: 'var(--vpk-accent)', background: 'var(--vpk-bg)' }}>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded border px-2 py-1"
                style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-surface)', color: 'var(--vpk-fg)' }}
              />
              {fieldSpecs.map((f) => (
                <input
                  key={f.key}
                  value={editValues[f.key] ?? ''}
                  onChange={(e) => setEditValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.multi ? `${f.label} (comma-separated)` : f.label}
                  className="rounded border px-2 py-1"
                  style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-surface)', color: 'var(--vpk-fg)' }}
                />
              ))}
              <div className="flex gap-2">
                <button onClick={() => void saveEdit()} className="cursor-pointer rounded border px-2 py-0.5 text-[11px]" style={{ borderColor: 'var(--vpk-accent)', color: 'var(--vpk-accent)' }}>
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="cursor-pointer rounded border px-2 py-0.5 text-[11px]" style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={row.id} className="grid items-center gap-2 rounded px-1.5 py-1" style={{ gridTemplateColumns: '1fr 2fr auto auto', opacity: row.isDisabled ? 0.5 : 1 }}>
              <span className="truncate" style={{ color: 'var(--vpk-fg)' }} title={row.name}>
                {row.name}
              </span>
              <span className="truncate font-mono text-[10px]" style={{ color: 'var(--vpk-fg-muted)' }} title={fieldsSummary(row.fields, fieldSpecs)}>
                {fieldsSummary(row.fields, fieldSpecs) || '—'}
              </span>
              <span className="text-[10px] uppercase" style={{ color: 'var(--vpk-fg-muted)' }}>
                {row.isDisabled ? 'removed' : row.isBuiltIn ? (row.isCustomized ? 'customized' : 'built-in') : 'custom'}
              </span>
              <div className="flex items-center gap-1 justify-self-end">
                {!row.isDisabled && (
                  <button onClick={() => startEdit(row)} className="cursor-pointer rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}>
                    Edit
                  </button>
                )}
                {row.isBuiltIn && (row.isCustomized || row.isDisabled) && (
                  <button onClick={() => void onSave(overrides.filter((o) => o.id !== row.id))} className="cursor-pointer rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}>
                    Reset
                  </button>
                )}
                {row.isBuiltIn && !row.isDisabled && (
                  <button onClick={() => void upsert(row.id, { disabled: true } as Partial<Override>)} className="cursor-pointer rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}>
                    Remove
                  </button>
                )}
                {!row.isBuiltIn && (
                  <button onClick={() => void onSave(overrides.filter((o) => o.id !== row.id))} className="cursor-pointer rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/**
 * Settings > Network Identification — review/edit the data-driven catalogs `inferNetworkPlane`/
 * `inferNetworkEdge` use to name a cluster's CNI plugin and service mesh (Network view's "Network Plane" /
 * "Edge" cards). Only the detection SIGNALS are editable here (DaemonSet names, CRD groups, annotation
 * prefixes, namespaces, mesh sidecar container name) — a built-in CNI's bespoke overlay/encapsulation
 * resolver logic (e.g. Cilium's ConfigMap tunnel-mode check) can't be expressed as data, so it's left as-is;
 * a brand-new CNI you add here is still correctly named, just without an encapsulation guess. Server-
 * persisted (POST /network-catalog), same reasoning as Vendor Icons — inference runs server-side only.
 */
export function NetworkCatalogPanel() {
  const [networkBase, setNetworkBase] = useState<CniBase[]>([]);
  const [networkOverrides, setNetworkOverridesState] = useState<CniOverride[]>([]);
  const [meshBase, setMeshBase] = useState<MeshBase[]>([]);
  const [meshOverrides, setMeshOverridesState] = useState<MeshOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/network-catalog')
      .then(
        (r) =>
          r.json() as Promise<{
            network: { base: CniBase[]; overrides: CniOverride[] };
            mesh: { base: MeshBase[]; overrides: MeshOverride[] };
          }>,
      )
      .then((d) => {
        setNetworkBase(d.network.base);
        setNetworkOverridesState(d.network.overrides);
        setMeshBase(d.mesh.base);
        setMeshOverridesState(d.mesh.overrides);
      })
      .catch(() => setError('Failed to load network catalog'))
      .finally(() => setLoading(false));
  }, []);

  async function persist(nextNetwork: CniOverride[], nextMesh: MeshOverride[]) {
    setNetworkOverridesState(nextNetwork);
    setMeshOverridesState(nextMesh);
    const r = await fetch('/network-catalog', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ network: nextNetwork, mesh: nextMesh }),
    });
    if (!r.ok) setError('Failed to save — change kept locally for this session only');
  }

  if (loading) {
    return (
      <div className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
        loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-xs">
      {error && <div style={{ color: 'var(--vpk-status-error)' }}>{error}</div>}
      <CatalogSection
        title="Container Network Interface (CNI)"
        hint="Used by the Network view's Network Plane card to name the cluster's CNI plugin."
        base={networkBase}
        overrides={networkOverrides}
        fieldSpecs={CNI_FIELDS}
        onSave={(next) => persist(next, meshOverrides)}
      />
      <CatalogSection
        title="Service Mesh"
        hint="Used by the Network view's Edge card to name the cluster's service mesh (Istio, Linkerd, ...)."
        base={meshBase}
        overrides={meshOverrides}
        fieldSpecs={MESH_FIELDS}
        onSave={(next) => persist(networkOverrides, next)}
      />
    </div>
  );
}
