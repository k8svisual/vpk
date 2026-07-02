import { useEffect, useState } from 'react';

interface Ref {
  id: string;
  name: string;
}
interface ContainerDto {
  name: string;
  image?: string;
  ready?: boolean;
  restartCount?: number;
  stateLabel?: string;
}
interface Schematic {
  podId: string;
  podName: string;
  namespace?: string;
  phase?: string;
  conditions: { type?: string; status?: string }[];
  containers: ContainerDto[];
  initContainers: ContainerDto[];
  ownerChain: { id: string; kind: string; name: string }[];
  generatorLabel?: string;
  config: { configMaps: Ref[]; secrets: Ref[] };
  network: { services: Ref[] };
  storage: { pvcs: Ref[] };
  security: { serviceAccount?: Ref };
}

const phaseColor: Record<string, string> = {
  Running: '#2e8b57',
  Succeeded: '#2e8b57',
  Pending: '#d4a017',
  Failed: '#c0392b',
  Unknown: '#999',
};

function GroupBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #d0d0d0', borderRadius: 4, padding: 8, minWidth: 180 }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: '#555' }}>{title}</div>
      {children}
    </div>
  );
}

function RefList({ refs, onSelect }: { refs: Ref[]; onSelect: (id: string) => void }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
      {refs.map((r) => (
        <li key={r.id} style={{ cursor: 'pointer', color: '#2a5db0' }} onClick={() => onSelect(r.id)}>
          {r.name}
        </li>
      ))}
    </ul>
  );
}

function ContainerRow({ c }: { c: ContainerDto }) {
  const color = c.ready ? '#2e8b57' : c.stateLabel === 'Completed' ? '#2e8b57' : '#c0392b';
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, padding: '2px 0' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span>{c.name}</span>
      <span style={{ color: '#777' }}>{c.stateLabel ?? (c.ready ? 'Ready' : 'NotReady')}</span>
      {!!c.restartCount && <span style={{ color: '#c0392b' }}>restarts:{c.restartCount}</span>}
    </div>
  );
}

export function SchematicView({ podId, onSelect }: { podId: string | null; onSelect: (id: string) => void }) {
  const [data, setData] = useState<Schematic | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!podId) {
      setData(null);
      return;
    }
    fetch(`/schematic?id=${encodeURIComponent(podId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'not found');
        return r.json() as Promise<Schematic>;
      })
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e: unknown) => {
        setData(null);
        setError(String(e));
      });
  }, [podId]);

  if (!podId) return <p style={{ color: '#888', fontSize: 13 }}>Select a Pod (e.g. from Search) to view its schematic.</p>;
  if (error) return <p style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>;
  if (!data) return <p style={{ color: '#888', fontSize: 13 }}>loading…</p>;

  return (
    <div style={{ fontSize: 13 }}>
      {data.ownerChain.length > 0 && (
        <div style={{ marginBottom: 10, color: '#555', fontSize: 12 }}>
          {data.ownerChain.map((o) => (
            <span key={o.id}>
              <span style={{ cursor: 'pointer', color: '#2a5db0' }} onClick={() => onSelect(o.id)}>
                {o.kind}/{o.name}
              </span>
              {' → '}
            </span>
          ))}
          <strong>Pod/{data.podName}</strong>
          {data.generatorLabel && (
            <span style={{ marginLeft: 8, padding: '1px 6px', background: '#eef2f6', borderRadius: 3 }}>
              managed-by: {data.generatorLabel}
            </span>
          )}
        </div>
      )}

      <div style={{ border: '2px solid #333', borderRadius: 6, padding: 10, marginBottom: 12, maxWidth: 360 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <strong>{data.podName}</strong>
          <span style={{ color: phaseColor[data.phase ?? ''] ?? '#999', fontWeight: 600 }}>{data.phase}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {data.conditions
            .filter((c) => c.status === 'True')
            .map((c) => (
              <span key={c.type} style={{ fontSize: 11, padding: '1px 6px', background: '#f0f0ee', borderRadius: 3 }}>
                {c.type}
              </span>
            ))}
        </div>
        {data.initContainers.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: '#777' }}>init containers</div>
            {data.initContainers.map((c) => (
              <ContainerRow key={c.name} c={c} />
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#777' }}>containers</div>
        {data.containers.map((c) => (
          <ContainerRow key={c.name} c={c} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(data.config.configMaps.length > 0 || data.config.secrets.length > 0) && (
          <GroupBox title="Config">
            {data.config.configMaps.length > 0 && <RefList refs={data.config.configMaps} onSelect={onSelect} />}
            {data.config.secrets.length > 0 && <RefList refs={data.config.secrets} onSelect={onSelect} />}
          </GroupBox>
        )}
        {data.network.services.length > 0 && (
          <GroupBox title="Network">
            <RefList refs={data.network.services} onSelect={onSelect} />
          </GroupBox>
        )}
        {data.storage.pvcs.length > 0 && (
          <GroupBox title="Storage">
            <RefList refs={data.storage.pvcs} onSelect={onSelect} />
          </GroupBox>
        )}
        {data.security.serviceAccount && (
          <GroupBox title="Security">
            <RefList refs={[data.security.serviceAccount]} onSelect={onSelect} />
          </GroupBox>
        )}
      </div>
    </div>
  );
}
