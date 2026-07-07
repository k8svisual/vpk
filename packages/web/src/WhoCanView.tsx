import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { iconUrlForKind } from './kindIcons';
import { ChipList } from './Chips';

interface ResourceRef {
  apiGroup: string;
  resource: string;
}
interface Grant {
  bindingId: string;
  bindingKind: 'RoleBinding' | 'ClusterRoleBinding';
  bindingName: string;
  bindingNamespace?: string;
  roleKind: 'Role' | 'ClusterRole';
  roleName: string;
  roleId?: string;
  scope: 'namespace' | 'cluster';
  restricted: boolean;
  resourceNames: string[];
}
interface Match {
  subject: { kind: string; name: string; namespace?: string; id?: string };
  grants: Grant[];
  partial: boolean;
}
interface Vocabulary {
  verbs: string[];
  resources: ResourceRef[];
}

export type Mode = 'any' | 'all';

/** The committed query — lifted to App so it survives the round-trip out to a subject's RBAC diagram and
 *  back (this view unmounts on navigation, like every non-3D view). Transient text-in-progress stays local. */
export interface WhoCanQueryState {
  verbs: string[];
  resources: ResourceRef[];
  namespace: string;
  mode: Mode;
}

export const EMPTY_WHOCAN_QUERY: WhoCanQueryState = { verbs: [], resources: [], namespace: '', mode: 'any' };

const link: React.CSSProperties = { color: '#2a5db0', cursor: 'pointer', textDecoration: 'none' };

/** Friendly label for a resource ref: bare name for the core group, `name (group)` otherwise. Also the
 *  datalist key, so the chosen label round-trips back to its ref. */
function resourceLabel(r: ResourceRef): string {
  return r.apiGroup ? `${r.resource} (${r.apiGroup})` : r.resource;
}

/** Encode a resource ref for the /who-can query param: `group:resource` (empty group = core). */
function resourceToken(r: ResourceRef): string {
  return `${r.apiGroup}:${r.resource}`;
}

/**
 * "Who can" RBAC query: pick verbs and/or resources (multi-select), optionally scope to a namespace, choose
 * ANY vs ALL coverage, and list every subject the snapshot's bindings grant it to. Each result drills into
 * that subject's RBAC diagram (onViewRbac) or opens a contributing binding/role in the editor (onSelect).
 */
export function WhoCanView({
  query,
  onQueryChange,
  onSelect,
  onViewRbac,
}: {
  query: WhoCanQueryState;
  /** The App setter itself — functional updates avoid two quick edits (verb then resource) clobbering each
   *  other when both run against the same `query` prop before a re-render. */
  onQueryChange: Dispatch<SetStateAction<WhoCanQueryState>>;
  onSelect: (id: string) => void;
  onViewRbac: (subject: { kind: string; name: string; namespace?: string }) => void;
}) {
  const { verbs, resources, namespace, mode } = query;
  const setVerbs = (v: string[]) => onQueryChange((prev) => ({ ...prev, verbs: v }));
  const setResources = (r: ResourceRef[]) => onQueryChange((prev) => ({ ...prev, resources: r }));
  const setNamespace = (ns: string) => onQueryChange((prev) => ({ ...prev, namespace: ns }));
  const setMode = (m: Mode) => onQueryChange((prev) => ({ ...prev, mode: m }));

  const [vocab, setVocab] = useState<Vocabulary>({ verbs: [], resources: [] });
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [results, setResults] = useState<Match[] | null>(null);

  useEffect(() => {
    fetch('/who-can/vocab')
      .then((r) => r.json() as Promise<Vocabulary>)
      .then(setVocab)
      .catch(() => setVocab({ verbs: [], resources: [] }));
    fetch('/namespaces')
      .then((r) => r.json() as Promise<string[]>)
      .then(setNamespaces)
      .catch(() => setNamespaces([]));
  }, []);

  const resourceByToken = useMemo(() => {
    const m = new Map<string, ResourceRef>();
    for (const r of vocab.resources) m.set(resourceToken(r), r);
    return m;
  }, [vocab.resources]);

  const hasQuery = verbs.length > 0 || resources.length > 0 || namespace !== '';

  useEffect(() => {
    if (!hasQuery) {
      setResults(null);
      return;
    }
    const params = new URLSearchParams();
    if (verbs.length) params.set('verbs', verbs.join(','));
    if (resources.length) params.set('resources', resources.map(resourceToken).join(','));
    if (namespace) params.set('ns', namespace);
    params.set('mode', mode);
    let cancelled = false;
    fetch(`/who-can?${params.toString()}`)
      .then((r) => r.json() as Promise<Match[]>)
      .then((m) => {
        if (!cancelled) setResults(m);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [verbs, resources, namespace, mode, hasQuery]);

  function addVerb(v: string) {
    const t = v.trim();
    if (t) onQueryChange((prev) => (prev.verbs.includes(t) ? prev : { ...prev, verbs: [...prev.verbs, t] }));
  }
  function addResource(token: string) {
    const ref = resourceByToken.get(token);
    if (!ref) return;
    onQueryChange((prev) =>
      prev.resources.some((r) => r.apiGroup === ref.apiGroup && r.resource === ref.resource)
        ? prev
        : { ...prev, resources: [...prev.resources, ref] },
    );
  }

  const cellCount = Math.max(1, verbs.length || 1) * Math.max(1, resources.length || 1);

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 720, marginBottom: 12 }}>
        <div>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Verbs</label>
          <select value="" onChange={(e) => addVerb(e.target.value)} style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}>
            <option value="" disabled>
              + verb… (blank = any)
            </option>
            {vocab.verbs
              .filter((v) => !verbs.includes(v))
              .map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
          </select>
          <ChipList items={verbs} label={(v) => v} onRemove={(i) => setVerbs(verbs.filter((_, j) => j !== i))} />
        </div>
        <div>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Resources</label>
          <select
            value=""
            onChange={(e) => addResource(e.target.value)}
            style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}
          >
            <option value="" disabled>
              + resource… (blank = any)
            </option>
            {vocab.resources
              .filter((r) => !resources.some((sel) => sel.apiGroup === r.apiGroup && sel.resource === r.resource))
              .map((r) => (
                <option key={resourceToken(r)} value={resourceToken(r)}>
                  {resourceLabel(r)}
                </option>
              ))}
          </select>
          <ChipList items={resources} label={resourceLabel} onRemove={(i) => setResources(resources.filter((_, j) => j !== i))} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: '#555' }}>Namespace</span>
          <select value={namespace} onChange={(e) => setNamespace(e.target.value)} style={{ fontSize: 12, padding: '3px 6px' }}>
            <option value="">Any namespace</option>
            {namespaces.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ color: cellCount > 1 ? '#555' : '#aaa' }}>Match</span>
          {(
            [
              ['any', 'any selected'],
              ['all', 'all selected'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              disabled={cellCount <= 1}
              title={cellCount <= 1 ? 'Only matters with multiple verbs/resources' : ''}
              style={{
                padding: '3px 10px',
                fontSize: 12,
                border: '1px solid #d0d0d0',
                background: mode === id && cellCount > 1 ? '#333' : '#fff',
                color: mode === id && cellCount > 1 ? '#fff' : cellCount <= 1 ? '#aaa' : '#333',
                cursor: cellCount <= 1 ? 'default' : 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!hasQuery && (
        <p style={{ color: '#888' }}>Pick one or more verbs, resources, or a namespace to see who has access.</p>
      )}
      {results && (
        <>
          <p style={{ color: '#555', marginBottom: 8 }}>
            {results.length} subject{results.length === 1 ? '' : 's'}
            {results.some((m) => m.partial) && (
              <span style={{ color: '#888' }}> · italic = limited to specific named objects</span>
            )}
          </p>
          {results.map((m) => (
            <div
              key={`${m.subject.kind}|${m.subject.namespace ?? ''}|${m.subject.name}`}
              style={{ margin: '8px 0', borderLeft: '2px solid #eee', paddingLeft: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => onViewRbac({ kind: m.subject.kind, name: m.subject.name, namespace: m.subject.namespace })}
                  title="View this subject's RBAC diagram"
                  style={{
                    fontSize: 11,
                    padding: '1px 8px',
                    borderRadius: 999,
                    border: '1px solid #5fb37e',
                    background: '#fff',
                    color: '#2e7d4f',
                    cursor: 'pointer',
                  }}
                >
                  diagram
                </button>
                <img src={iconUrlForKind(m.subject.kind)} alt="" style={{ width: 14, height: 14 }} />
                <span
                  style={{ fontWeight: 600, fontStyle: m.partial ? 'italic' : 'normal', cursor: m.subject.id ? 'pointer' : 'default', color: m.subject.id ? '#2a5db0' : 'inherit' }}
                  onClick={() => m.subject.id && onSelect(m.subject.id)}
                >
                  {m.subject.kind}: {m.subject.name}
                </span>
                {m.subject.namespace && <span style={{ color: '#777' }}>({m.subject.namespace})</span>}
              </div>
              <div style={{ paddingLeft: 20, marginTop: 2 }}>
                {m.grants.map((gr) => (
                  <div key={gr.bindingId} style={{ color: '#444', margin: '2px 0' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 3,
                        marginRight: 6,
                        background: gr.scope === 'cluster' ? '#5a5a5a' : '#b3b0a8',
                        color: gr.scope === 'cluster' ? '#fff' : '#333',
                      }}
                    >
                      {gr.scope === 'cluster' ? 'cluster-wide' : gr.bindingNamespace ?? 'namespace'}
                    </span>
                    <span style={link} onClick={() => onSelect(gr.bindingId)}>
                      {gr.bindingKind}/{gr.bindingName}
                    </span>
                    {' → '}
                    {gr.roleId ? (
                      <span style={link} onClick={() => onSelect(gr.roleId as string)}>
                        {gr.roleKind}/{gr.roleName}
                      </span>
                    ) : (
                      <span style={{ color: '#c0392b' }}>
                        {gr.roleKind}/{gr.roleName} (not in snapshot)
                      </span>
                    )}
                    {gr.restricted && gr.resourceNames.length > 0 && (
                      <span style={{ color: '#888' }}> — only: {gr.resourceNames.join(', ')}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {results.length === 0 && <p style={{ color: '#888' }}>No subjects match this query in this snapshot.</p>}
        </>
      )}
    </div>
  );
}
