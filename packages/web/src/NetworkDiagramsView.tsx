import { useEffect, useState } from 'react';
import { MousePointerClick } from 'lucide-react';
import { SvgDiagram } from './SvgDiagram';
import { NodePodsModal } from './NodePodsModal';
import { EndpointSlicesModal } from './EndpointSlicesModal';
import { KindIcon } from './StorageView';
import { networkIconBg } from './kindColors';
import { EmptyState } from './EmptyState';

interface ServiceOption {
  id: string;
  name: string;
  namespace?: string;
}
interface LayerEntry {
  label: string;
  count?: number;
  evidence?: string;
  kind?: string;
  nodeRole?: 'worker';
}
interface Layer {
  title: string;
  entries: LayerEntry[];
}

type DiagramType = 'flow' | 'ingress' | 'nodes' | 'topology' | 'layers';

const DIAGRAMS: { type: DiagramType; label: string; scoped: boolean }[] = [
  { type: 'flow', label: 'Client → Service → Pods', scoped: true },
  { type: 'ingress', label: 'Ingress Path', scoped: true },
  { type: 'nodes', label: 'Service × Nodes', scoped: true },
  { type: 'topology', label: 'Cluster Topology', scoped: false },
  { type: 'layers', label: 'Network Layers', scoped: false },
];

const HINT: Record<DiagramType, string> = {
  flow: 'External client → the Service (ClusterIP + selector) → its backing Pods.',
  ingress: 'North-south entry: External User → LoadBalancer/Ingress/Route → Service → EndpointSlice → Pods.',
  nodes: 'The Service’s backing Pods grouped by the cluster Node each one runs on.',
  topology: 'Per-Node Pod CIDRs / IPs and the (CNI-dependent) overlay that connects them.',
  layers: 'The Kubernetes networking stack, with live counts from this snapshot.',
};

export function NetworkDiagramsView({ namespaces, onSelect }: { namespaces: string[]; onSelect: (id: string) => void }) {
  const [type, setType] = useState<DiagramType>('flow');
  // Default to ALL namespaces so the service picker offers every Service in the snapshot (the namespace
  // dropdown stays available as an optional filter).
  const [ns, setNs] = useState('');
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [svcId, setSvcId] = useState('');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [layers, setLayers] = useState<Layer[]>([]);
  const [nodeModal, setNodeModal] = useState<{ id: string; name: string } | null>(null);
  const [epsModal, setEpsModal] = useState<{ serviceId: string; serviceName: string } | null>(null);

  const scoped = DIAGRAMS.find((d) => d.type === type)?.scoped ?? false;

  // Service list for the scoped diagrams' picker (reuses the cards endpoint's id/name/namespace).
  useEffect(() => {
    if (!scoped) return;
    const q = ns ? `?ns=${encodeURIComponent(ns)}` : '';
    // Guards against a slower response for a PREVIOUS namespace selection landing after a newer one has
    // already started — without this a fast namespace switch can leave the picker showing the wrong list.
    let cancelled = false;
    fetch(`/network${q}`)
      .then((r) => r.json() as Promise<ServiceOption[]>)
      .then((list) => {
        if (cancelled) return;
        setServices(list);
        setSvcId((cur) => (list.some((s) => s.id === cur) ? cur : (list[0]?.id ?? '')));
      })
      .catch(() => {
        if (!cancelled) setServices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ns, scoped]);

  // Fetch the diagram SVG (or the layers JSON) for the current selection.
  useEffect(() => {
    setError('');
    // Guards against a slower response for a PREVIOUS diagram type/Service selection landing after a newer
    // one has already started — without this a fast click through diagram types or Services can leave the
    // view showing the wrong diagram (or the wrong Service's diagram) once the stale response finally lands.
    let cancelled = false;
    if (type === 'layers') {
      fetch('/network/layers')
        .then((r) => r.json() as Promise<Layer[]>)
        .then((l) => {
          if (!cancelled) setLayers(l);
        })
        .catch(() => {
          if (!cancelled) setLayers([]);
        });
      setSvg('');
      return () => {
        cancelled = true;
      };
    }
    if (type === 'topology') {
      fetch('/network/topology.svg')
        .then((r) => r.text())
        .then((t) => {
          if (!cancelled) setSvg(t);
        })
        .catch(() => {
          if (!cancelled) setSvg('');
        });
      return () => {
        cancelled = true;
      };
    }
    if (!svcId) {
      setSvg('');
      return;
    }
    fetch(`/network/diagram.svg?id=${encodeURIComponent(svcId)}&type=${type}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('diagram unavailable for this selection');
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setSvg(text);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSvg('');
        setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [type, svcId]);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: scoped ? 8 : 10 }}>
        {DIAGRAMS.map((d) => (
          <button
            key={d.type}
            onClick={() => setType(d.type)}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 5,
              border: '1px solid var(--vpk-border, #d0d0d0)',
              background: type === d.type ? '#2a5db0' : 'var(--vpk-surface, #fff)',
              color: type === d.type ? '#fff' : 'var(--vpk-fg, #333)',
              cursor: 'pointer',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Namespace + service pickers sit on their own row directly beneath the diagram-type buttons (not
          floated right), shown for every scoped diagram type that uses them. */}
      {scoped && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: 'var(--vpk-fg, #333)' }}>Select a Service</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#555' }}>
            <select value={ns} onChange={(e) => setNs(e.target.value)} style={{ fontSize: 12, cursor: 'pointer' }}>
              <option value="">All namespaces</option>
              {namespaces.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select value={svcId} onChange={(e) => setSvcId(e.target.value)} style={{ fontSize: 12, cursor: 'pointer', maxWidth: 340 }}>
              <option value="">Select a service ({services.length})</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {/* Show namespace when the list spans all namespaces, so the flat all-services list is navigable. */}
                  {ns ? s.name : `${s.namespace ?? '—'} / ${s.name}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--vpk-fg-muted, #888)', margin: '0 0 12px' }}>{HINT[type]}</p>

      {error && <p style={{ fontSize: 13, color: 'var(--vpk-status-error, #c0392b)' }}>{error}</p>}
      {scoped && !svcId && !error && <EmptyState icon={MousePointerClick}>Select a service to render this diagram.</EmptyState>}

      {type === 'layers' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {layers.map((layer) => (
            <div key={layer.title}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{layer.title}</div>
              <div style={{ marginLeft: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {layer.entries.map((e) => (
                  <div key={e.label} style={{ display: 'flex', gap: 8, fontSize: 12.5, alignItems: 'center' }}>
                    <span style={{ minWidth: 48, textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: e.count === undefined ? '#bbb' : '#2a5db0' }}>
                      {e.count === undefined ? (e.evidence ? '≈' : '—') : e.count}
                    </span>
                    {/* k8s icon with the 3D-wheel kind colour (worker-node colour for Node entries, light grey
                        for kinds the wheel doesn't draw). Generic mechanisms (DNS/iptables/CNI/VPC) have no kind
                        → no icon. */}
                    {e.kind && <KindIcon kind={e.kind} size={14} bg={networkIconBg(e.kind)} />}
                    <span style={{ color: e.count === undefined && !e.evidence ? 'var(--vpk-fg-muted, #888)' : 'var(--vpk-fg, #333)', fontStyle: e.count === undefined && !e.evidence ? 'italic' : 'normal' }}>
                      {e.label}
                    </span>
                    {e.evidence && (
                      <span style={{ color: 'var(--vpk-fg-muted, #999)', fontSize: 11, fontStyle: 'italic' }}>inferred · {e.evidence}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        svg && (
          <div style={{ overflowX: 'auto' }}>
            <SvgDiagram
              svg={svg}
              onSelect={onSelect}
              onNodeClick={type === 'topology' ? (id, name) => setNodeModal({ id, name }) : undefined}
              onEndpointSlicesClick={type === 'ingress' ? (serviceId, serviceName) => setEpsModal({ serviceId, serviceName }) : undefined}
            />
          </div>
        )
      )}
      {nodeModal && (
        <NodePodsModal nodeId={nodeModal.id} nodeName={nodeModal.name} onSelect={onSelect} onClose={() => setNodeModal(null)} />
      )}
      {epsModal && (
        <EndpointSlicesModal
          serviceId={epsModal.serviceId}
          serviceName={epsModal.serviceName}
          onSelect={onSelect}
          onClose={() => setEpsModal(null)}
        />
      )}
    </div>
  );
}
