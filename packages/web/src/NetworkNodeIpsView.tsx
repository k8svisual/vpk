import { useEffect, useState } from 'react';
import { KindIcon } from './StorageView';
import { networkIconBg } from './kindColors';

interface NodePod {
  id: string;
  name: string;
  namespace?: string;
  podIp?: string;
}
interface NetworkNode {
  id: string;
  name: string;
  internalIp?: string;
  podCidr?: string;
  pods: NodePod[];
}

/** Group pod IPs by their /24 prefix (first three octets) — DESIGN §6.10 IP-range aggregation. */
function prefixOf(ip: string | undefined): string {
  if (!ip) return 'unknown';
  const parts = ip.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : ip;
}

function isHostNetwork(ip: string | undefined, internalIp: string | undefined): boolean {
  return !!ip && ip === internalIp;
}

export function NetworkNodeIpsView({ onSelect }: { onSelect: (id: string) => void }) {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/network/nodes')
      .then((r) => r.json() as Promise<NetworkNode[]>)
      .then(setNodes)
      .catch(() => setNodes([]));
  }, []);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {nodes.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>No nodes in this snapshot.</p>}
      {nodes.map((node) => {
        const ranges = new Map<string, NodePod[]>();
        for (const pod of node.pods) {
          const key = isHostNetwork(pod.podIp, node.internalIp) ? `host ${node.internalIp}` : prefixOf(pod.podIp);
          const list = ranges.get(key) ?? [];
          list.push(pod);
          ranges.set(key, list);
        }

        return (
          <div key={node.id} style={{ border: '1px solid #d0d0d0', borderRadius: 4, overflow: 'hidden' }}>
            <div
              onClick={() => onSelect(node.id)}
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
              <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <KindIcon kind="Node" name={node.name} size={16} bg={networkIconBg('Node')} />
                {node.name}
              </strong>
              <span style={{ color: '#555' }}>host {node.internalIp ?? '—'}</span>
              <span style={{ color: '#555' }}>podCIDR {node.podCidr ?? '—'}</span>
              <span style={{ color: '#555' }}>{node.pods.length} pods</span>
            </div>
            <div style={{ padding: '4px 10px', fontSize: 12 }}>
              {[...ranges.entries()].map(([range, pods]) => {
                const key = `${node.id}|${range}`;
                const open = expanded.has(key);
                return (
                  <div key={range} style={{ margin: '4px 0' }}>
                    <div
                      onClick={() => toggle(key)}
                      style={{ cursor: 'pointer', color: '#2a5db0', display: 'flex', gap: 6, alignItems: 'center' }}
                    >
                      <span>{open ? '▾' : '▸'}</span>
                      <span>{range}</span>
                      <span style={{ color: '#777' }}>({pods.length})</span>
                    </div>
                    {open && (
                      <ul style={{ margin: '2px 0 4px', paddingLeft: 28, color: '#444' }}>
                        {pods.map((pod) => (
                          <li
                            key={pod.id}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => onSelect(pod.id)}
                          >
                            <KindIcon kind="Pod" name={pod.name} size={13} bg={networkIconBg('Pod')} />
                            {pod.name} <span style={{ color: '#999' }}>({pod.namespace})</span> — {pod.podIp ?? '—'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
