import { useEffect, useState } from 'react';

interface Rule {
  apiGroups?: string[];
  resources?: string[];
  verbs?: string[];
  resourceNames?: string[];
  nonResourceURLs?: string[];
}
interface Binding {
  bindingId: string;
  bindingKind: 'RoleBinding' | 'ClusterRoleBinding';
  bindingName: string;
  namespace?: string;
  roleKind: 'Role' | 'ClusterRole';
  roleName: string;
  roleId?: string;
  rules: Rule[];
}
interface Subject {
  kind: string;
  name: string;
  namespace?: string;
  bindings: Binding[];
}

function ruleSummary(r: Rule): string {
  const groups = (r.apiGroups ?? []).map((g) => (g === '' ? 'core' : g)).join(',') || '*';
  const resources = (r.resources ?? r.nonResourceURLs ?? []).join(',') || '*';
  const verbs = (r.verbs ?? []).join(',') || '*';
  return `${verbs} ${groups}/${resources}`;
}

const link: React.CSSProperties = { color: 'var(--vpk-accent)', cursor: 'pointer', textDecoration: 'none' };

export function SecurityView({
  onSelect,
  onViewRbac,
}: {
  onSelect: (id: string) => void;
  /** Opens the RBAC view pre-scoped to this subject (identity, not a resource id — User/Group subjects have
   *  no backing resource in the snapshot). Rendered as a small "diagram" pill on each subject row. */
  onViewRbac?: (subject: { kind: string; name: string; namespace?: string }) => void;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    fetch('/security')
      .then((r) => r.json() as Promise<Subject[]>)
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  const byKind = new Map<string, Subject[]>();
  for (const s of subjects) {
    const list = byKind.get(s.kind) ?? [];
    list.push(s);
    byKind.set(s.kind, list);
  }

  return (
    <div style={{ fontSize: 13 }}>
      {subjects.length === 0 && <p style={{ color: 'var(--vpk-fg-muted)' }}>No RBAC bindings found.</p>}
      {[...byKind.entries()].map(([kind, list]) => (
        <details key={kind} open style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '4px 0' }}>
            {kind} <span style={{ fontWeight: 400, color: 'var(--vpk-fg-muted)' }}>({list.length})</span>
          </summary>
          <div style={{ paddingLeft: 16 }}>
            {list.map((s) => (
              <details key={`${s.kind}|${s.namespace ?? ''}|${s.name}`} style={{ marginBottom: 4 }}>
                <summary style={{ cursor: 'pointer', padding: '2px 0' }}>
                  {onViewRbac && (
                    <button
                      onClick={(e) => {
                        e.preventDefault(); // don't also toggle this row's <details>
                        e.stopPropagation();
                        onViewRbac({ kind: s.kind, name: s.name, namespace: s.namespace });
                      }}
                      title="View this subject's RBAC diagram"
                      style={{
                        marginRight: 8,
                        fontSize: 11,
                        padding: '1px 8px',
                        borderRadius: 999,
                        border: '1px solid var(--vpk-status-ok)',
                        background: 'var(--vpk-surface)',
                        color: 'var(--vpk-status-ok)',
                        cursor: 'pointer',
                      }}
                    >
                      diagram
                    </button>
                  )}
                  {s.name}
                  {s.namespace && <span style={{ color: 'var(--vpk-fg-muted)' }}> ({s.namespace})</span>}
                  <span style={{ color: 'var(--vpk-fg-muted)' }}> — {s.bindings.length} binding{s.bindings.length === 1 ? '' : 's'}</span>
                </summary>
                <div style={{ paddingLeft: 16 }}>
                  {s.bindings.map((b) => (
                    <div key={b.bindingId} style={{ margin: '6px 0', borderLeft: '2px solid var(--vpk-border)', paddingLeft: 8 }}>
                      <div>
                        <span style={link} onClick={() => onSelect(b.bindingId)}>
                          {b.bindingKind}/{b.bindingName}
                        </span>
                        {b.namespace && <span style={{ color: 'var(--vpk-fg-muted)' }}> ({b.namespace})</span>}
                        {' → '}
                        {b.roleId ? (
                          <span style={link} onClick={() => onSelect(b.roleId as string)}>
                            {b.roleKind}/{b.roleName}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--vpk-status-error)' }}>
                            {b.roleKind}/{b.roleName} (not in snapshot)
                          </span>
                        )}
                      </div>
                      {b.rules.length > 0 && (
                        <ul style={{ margin: '2px 0', paddingLeft: 18, color: 'var(--vpk-fg-muted)' }}>
                          {b.rules.map((r, i) => (
                            <li key={i}>{ruleSummary(r)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
