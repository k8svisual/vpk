import { useEffect, useState } from 'react';
import { iconUrlForKind } from './kindIcons';
import { NetworkNodeIpsView } from './NetworkNodeIpsView';

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

// Fixed column widths, shared by every service card's header row and every card's pod table — each card
// sizes its own flex/table content independently, so without a shared width the same column drifts left and
// right from one card to the next. Pixel widths (not `fr`/`auto`) are what make that alignment hold.
const SVC_NAME_COL = '280px';
const SVC_NS_COL = '150px';
const SVC_IP_COL = '170px';
const POD_ICON_SIZE = 20;
const POD_ICON_INDENT = 22 + POD_ICON_SIZE * 0.5; // shifted right of the connector spine by at least half an icon width
const POD_ICON_COL = POD_ICON_INDENT + POD_ICON_SIZE + 6;
const POD_NAME_COL = 340;
const POD_IP_COL = 150;

type Mode = 'services' | 'nodes';

export function NetworkView({
  namespaces,
  onSelect,
}: {
  namespaces: string[];
  onSelect: (id: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('services');
  const [ns, setNs] = useState('kube-system');

  return (
    <div>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          background: 'var(--vpk-bg)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          paddingBottom: 10,
        }}
      >
        {/* `main`'s own top padding sits above this sticky box but is still part of its scroll area, so
            scrolled-past rows can peek through that gap as they pass behind it. This shim repaints that gap
            in the same background, anchored to the sticky box so it scrolls/sticks along with it. */}
        <div style={{ position: 'absolute', top: -13, left: -13, right: -13, height: 13, background: 'var(--vpk-bg)' }} />
        {(
          [
            ['services', 'Services-To-Pods'],
            ['nodes', 'Node & Pod IPs'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            style={{
              padding: '3px 10px',
              fontSize: 12,
              border: '1px solid #d0d0d0',
              background: mode === id ? '#333' : '#fff',
              color: mode === id ? '#fff' : '#333',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
        {mode === 'services' && (
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' }}>
            namespace
            <select
              value={ns}
              onChange={(e) => setNs(e.target.value)}
              style={{ padding: '2px 4px', fontSize: 12, cursor: 'pointer' }}
            >
              <option value="">All namespaces</option>
              {namespaces.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {mode === 'services' ? (
        <ServicesToPodsMode namespace={ns} onSelect={onSelect} />
      ) : (
        <NetworkNodeIpsView onSelect={onSelect} />
      )}
    </div>
  );
}

function ServicesToPodsMode({ namespace, onSelect }: { namespace: string; onSelect: (id: string) => void }) {
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
              display: 'grid',
              gridTemplateColumns: `${SVC_NAME_COL} ${SVC_NS_COL} ${SVC_IP_COL} 1fr`,
              alignItems: 'baseline',
              padding: '6px 10px',
              background: '#eef2f6',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <img
                src={iconUrlForKind('Service')}
                alt=""
                style={{ display: 'inline', width: 17, height: 17, marginRight: 5, verticalAlign: 'text-bottom' }}
              />
              {svc.name}
            </strong>
            <span style={{ color: '#555' }}>{svc.namespace}</span>
            <span style={{ color: '#555' }}>ClusterIP {svc.clusterIp ?? '—'}</span>
            <span style={{ color: '#555' }}>
              {svc.ports.map((p) => `${p.port}${p.protocol && p.protocol !== 'TCP' ? `/${p.protocol}` : ''}`).join(', ')}
            </span>
          </div>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', fontSize: 12 }}>
            <colgroup>
              <col style={{ width: POD_ICON_COL }} />
              <col style={{ width: POD_NAME_COL }} />
              <col style={{ width: POD_IP_COL }} />
              <col />
            </colgroup>
            <tbody>
              {svc.pods.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '6px 10px', color: '#999' }}>
                    no backing pods
                  </td>
                </tr>
              )}
              {svc.pods.map((pod, i) => {
                const isLast = i === svc.pods.length - 1;
                return (
                  <tr
                    key={pod.id}
                    onClick={() => onSelect(pod.id)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f8f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ position: 'relative', width: POD_ICON_COL, padding: '4px 0', verticalAlign: 'middle' }}>
                      {/* Tree connector back up to the service — spine down the left edge, joined by every
                          pod's stub, so the whole column reads as one branching line rather than N floating
                          icons. The spine stops halfway on the last row instead of running past it. */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 16,
                          top: 0,
                          bottom: isLast ? '50%' : 0,
                          borderLeft: '1px solid #c8c8c8',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: 16,
                          top: '50%',
                          width: POD_ICON_INDENT - 16,
                          borderTop: '1px solid #c8c8c8',
                        }}
                      />
                      <img
                        src={iconUrlForKind('Pod')}
                        alt=""
                        title={pod.phase ?? (pod.ready ? 'Ready' : 'NotReady')}
                        style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: POD_ICON_SIZE,
                          height: POD_ICON_SIZE,
                          marginLeft: POD_ICON_INDENT,
                        }}
                      />
                    </td>
                    <td style={{ padding: '4px 10px', verticalAlign: 'middle' }}>{pod.name}</td>
                    <td style={{ padding: '4px 10px', color: '#555', verticalAlign: 'middle' }}>
                      pod {pod.podIp ?? '—'}
                    </td>
                    <td style={{ padding: '4px 10px', color: '#555', verticalAlign: 'middle' }}>
                      node {pod.nodeName ?? '—'} ({pod.nodeIp ?? '—'})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
