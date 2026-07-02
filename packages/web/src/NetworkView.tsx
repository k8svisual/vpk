import { useEffect, useState } from 'react';

interface NetworkPod {
  id: string;
  name: string;
  podIp?: string;
  ready: boolean;
  phase?: string;
  nodeName?: string;
  nodeIp?: string;
}
interface NetworkService {
  id: string;
  name: string;
  namespace?: string;
  clusterIp?: string;
  ports: { name?: string; port?: number; protocol?: string; targetPort?: number | string }[];
  pods: NetworkPod[];
}

const phaseColor: Record<string, string> = {
  Running: '#2e8b57',
  Succeeded: '#2e8b57',
  Pending: '#d4a017',
  Failed: '#c0392b',
  Unknown: '#999',
};

export function NetworkView({ namespace, onSelect }: { namespace: string; onSelect: (id: string) => void }) {
  const [cards, setCards] = useState<NetworkService[]>([]);

  useEffect(() => {
    const q = namespace ? `?ns=${encodeURIComponent(namespace)}` : '';
    fetch(`/network${q}`)
      .then((r) => r.json() as Promise<NetworkService[]>)
      .then(setCards)
      .catch(() => setCards([]));
  }, [namespace]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {cards.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>No services in this namespace.</p>}
      {cards.map((svc) => (
        <div key={svc.id} style={{ border: '1px solid #d0d0d0', borderRadius: 4, overflow: 'hidden' }}>
          <div
            onClick={() => onSelect(svc.id)}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'baseline',
              padding: '6px 10px',
              background: '#eef2f6',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <strong>{svc.name}</strong>
            <span style={{ color: '#555' }}>{svc.namespace}</span>
            <span style={{ color: '#555' }}>ClusterIP {svc.clusterIp ?? '—'}</span>
            <span style={{ color: '#555' }}>
              {svc.ports.map((p) => `${p.port}${p.protocol && p.protocol !== 'TCP' ? `/${p.protocol}` : ''}`).join(', ')}
            </span>
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <tbody>
              {svc.pods.length === 0 && (
                <tr>
                  <td style={{ padding: '6px 10px', color: '#999' }}>no backing pods</td>
                </tr>
              )}
              {svc.pods.map((pod) => (
                <tr
                  key={pod.id}
                  onClick={() => onSelect(pod.id)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f8f6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '4px 10px', width: 12 }}>
                    <span
                      title={pod.phase ?? (pod.ready ? 'Ready' : 'NotReady')}
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: phaseColor[pod.phase ?? ''] ?? (pod.ready ? '#2e8b57' : '#c0392b'),
                      }}
                    />
                  </td>
                  <td style={{ padding: '4px 10px' }}>{pod.name}</td>
                  <td style={{ padding: '4px 10px', color: '#555' }}>pod {pod.podIp ?? '—'}</td>
                  <td style={{ padding: '4px 10px', color: '#555' }}>
                    node {pod.nodeName ?? '—'} ({pod.nodeIp ?? '—'})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
