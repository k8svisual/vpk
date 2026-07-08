import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { iconUrlForKind } from './kindIcons';

interface WorkingSetEntry {
  kind: string;
  count: number;
}

/** Remembers one Kind's last-used form values — restored the next time its modal is opened, and included
 *  wholesale in a Settings save so a saved file reproduces every Kind you'd configured, not just the one
 *  open at save time. */
interface KindFormMemory {
  count: number;
  values: Record<string, string>;
  /** Node-only. */
  masterCount?: number;
}

/** Everything the Settings save/load round-trips — every Bundle field plus per-Kind form memory. Kept as a
 *  loose Record client-side-only shape (the server treats it as an opaque blob — see demoSettings.ts) so
 *  adding a new Bundle field here never requires a server-side change. */
interface DemoDataSettings {
  bundleNamespace: string;
  additionalNamespaceCount: number;
  pvcPercent: number;
  servicePodPercent: number;
  serviceSharedPercent: number;
  podsPerNodePattern: string;
  failedPodCount: number;
  warningPodCount: number;
  cronJobPercent: number;
  statefulSetPercent: number;
  jobPercent: number;
  includeStandardLaunchEvents: boolean;
  podsPerGateway: number;
  httpRoutePercent: number;
  networkPolicyPercent: number;
  /** Timelapse-only: simulates some Pods getting replaced/rolled during the timestamp window (synthetic
   *  metadata.deletionTimestamp) so demo timelapse playback isn't just monotonic growth. Opt-in — see
   *  simulatePodChurn's own doc comment in demoTimestamps.ts for why. */
  simulatePodChurn: boolean;
  podChurnPercent: number;
  kindForms: Record<string, KindFormMemory>;
}

// Sensible starting patterns for placeholders Node (and a couple of other templates) actually use — see
// @vpk/demo-data's resolvePattern for the full pattern language ({n}, {guid}, {from-to}/{from-to,step}
// ranges, and multi-range odometer/carry within one pattern). Anything not listed here falls back to a plain
// "demo-{n}" — every placeholder is still editable in the form regardless of whether it has a smarter default.
const DEFAULT_PATTERNS: Record<string, string> = {
  name: 'demo-{n}',
  // Spreads generated items round-robin across whatever Namespaces are currently staged — generate those
  // first (Bundles section below) or this throws. Override with a literal (e.g. "default") to pin everything
  // to one namespace instead.
  namespace: '{namespace}',
  nodeName: 'demo-node-{n}',
  role: 'worker',
  // Two range tokens in one pattern odometer together: the 4th octet cycles fastest, carrying into the 3rd
  // once it wraps — 10.0.0.0, 10.0.0.1, ..., 10.0.0.255, 10.0.1.0, ... up to 65,536 unique addresses.
  internalIP: '10.0.{0-255}.{0-255}',
  cpuCapacity: '8',
  cpuAllocatable: '{4000-8000,250}m',
  memCapacityKi: '16000000Ki',
  memAllocatableKi: '15000000Ki',
  podCapacity: '110',
  // A plain range with no {n} — cycles 50, 51, ..., 200, 50, ... across generated items for size variety.
  podAllocatable: '{50-200}',
  ephemeralStorageCapacity: '100000000',
  ephemeralStorageAllocatable: '95000000',
  // {guid} for identity-like fields — a fresh random UUID per item, not sequential.
  machineID: '{guid}',
  systemUUID: '{guid}',
  bootID: '{guid}',
  gatewayName: 'demo-gateway-{n}',
  serviceName: 'demo-svc-{n}',
  // {image} picks one of three made-up demo registries at random and builds a repo/name:tag reference —
  // this is demo data, not a real image.
  image: '{image}',
  phase: 'Running',
  targetName: 'demo-{n}',
  podIP: '10.1.{0-255}.{0-255}',
  clusterIP: '10.96.{0-255}.{0-255}',
};

const fieldStyle = { borderColor: 'var(--vpk-border)' };

// Every Bundle checkbox's id, matching BUNDLE_DEFS below one-to-one — hoisted out so the initial
// `checkedBundles` state can default every Bundle to checked without waiting for BUNDLE_DEFS itself (which
// closes over component state and can only be built inside the component).
const ALL_BUNDLE_IDS = [
  'namespaces',
  'system-pods',
  'rbac',
  'config-secrets',
  'storage-csi',
  'csi-node-sync',
  'daemonsets',
  'deployments',
  'pvc-pv',
  'services',
  'pods-per-node',
  'workloads',
  'service-accounts',
  'events',
  'gateway',
  'network-policies',
  'quota-limits',
  'config-secret-refs',
];

/** Pulls the [min,max] out of a pattern's first range token (e.g. "{100-150,Random}" -> [100,150]) for the
 *  Bundle resource-count estimates below — falls back to treating the whole pattern as a fixed number (or
 *  [0,0] if it's not one) when there's no range token, e.g. a literal "20". Only looks at the FIRST range
 *  token, which is enough for the one bundle field (Pods per Node) that actually uses this. */
function parsePatternRange(pattern: string): [number, number] {
  const match = pattern.match(/\{(\d+)-(\d+)(?:,[^}]+)?\}/);
  if (match) return [Number(match[1]), Number(match[2])];
  const n = Number(pattern);
  return Number.isFinite(n) ? [n, n] : [0, 0];
}

/** Formats an estimate range as "12" when min===max, or "12-30" otherwise. */
function formatRange([min, max]: [number, number]): string {
  return min === max ? String(min) : `${min}-${max}`;
}

/**
 * Demo Data screen: pick a Kind, fill in a pattern per placeholder (see @vpk/demo-data's demoTemplates.ts),
 * generate N items into a working directory staged alongside real snapshots, then "Finish" merges everything
 * staged into a real snapshot file that shows up in the existing snapshot dropdown. Generic across every
 * templated Kind — the form is built from whatever placeholders the server reports for the selected Kind
 * (`GET /demo/templates/:kind/placeholders`), not hand-coded per Kind.
 */
export function DemoDataView() {
  const [kinds, setKinds] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [count, setCount] = useState(3);
  const [working, setWorking] = useState<WorkingSetEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [finishName, setFinishName] = useState('');
  const [bundleNamespace, setBundleNamespace] = useState('default');
  const [additionalNamespaceCount, setAdditionalNamespaceCount] = useState(3);
  const [pvcPercent, setPvcPercent] = useState(15);
  const [servicePodPercent, setServicePodPercent] = useState(20);
  const [serviceSharedPercent, setServiceSharedPercent] = useState(15);
  const [podsPerNodePattern, setPodsPerNodePattern] = useState('{100-150,Random}');
  const [failedPodCount, setFailedPodCount] = useState(5);
  const [warningPodCount, setWarningPodCount] = useState(10);
  const [cronJobPercent, setCronJobPercent] = useState(5);
  const [statefulSetPercent, setStatefulSetPercent] = useState(5);
  const [jobPercent, setJobPercent] = useState(10);
  const [includeStandardLaunchEvents, setIncludeStandardLaunchEvents] = useState(false);
  const [podsPerGateway, setPodsPerGateway] = useState(100);
  const [httpRoutePercent, setHttpRoutePercent] = useState(50);
  const [networkPolicyPercent, setNetworkPolicyPercent] = useState(50);
  const [simulatePodChurn, setSimulatePodChurn] = useState(false);
  const [podChurnPercent, setPodChurnPercent] = useState(10);
  // Node-only: of `count` Nodes generated this call, the first `nodeMasterCount` get role=master, the rest
  // role=worker — set directly server-side rather than through values.role's pattern (see server.ts's
  // buildGeneratedItems).
  const [nodeMasterCount, setNodeMasterCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{ ok: boolean; message: string } | null>(null);
  // Every Kind's last-used form (values/count/masterCount) — restored when its modal is reopened, and
  // included wholesale in a Settings save (see DemoDataSettings) so a saved file reproduces every Kind
  // you'd configured, not just whichever one happened to be open.
  const [kindForms, setKindForms] = useState<Record<string, KindFormMemory>>({});
  const [settingsAvailable, setSettingsAvailable] = useState<{ app: boolean; snapshot: boolean }>({ app: false, snapshot: false });
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  // Which Bundles are checked — a single "Generate" button (see generateCheckedBundles below) runs every
  // checked one, in this fixed dependency-respecting order (Namespaces before things that spread across
  // them, Pods before things that read the Pod count, ...), instead of each Bundle having its own button.
  // Every Bundle defaults to checked — "generate a full, plausible cluster" is the common case; the standard
  // launch Events option (a separate, non-Bundle checkbox nested in the Events row) defaults OFF instead,
  // since at scale it's a lot more Events than most people want on the first pass.
  const [checkedBundles, setCheckedBundles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_BUNDLE_IDS.map((id) => [id, true])),
  );
  const [bundleResourcesExpanded, setBundleResourcesExpanded] = useState(false);

  function refreshWorking() {
    fetch('/demo/working')
      .then((r) => r.json() as Promise<WorkingSetEntry[]>)
      .then(setWorking)
      .catch(() => setWorking([]));
  }

  function refreshSettingsAvailability() {
    fetch('/demo/settings')
      .then((r) => r.json() as Promise<{ app: unknown; snapshot: unknown }>)
      .then((d) => setSettingsAvailable({ app: d.app != null, snapshot: d.snapshot != null }))
      .catch(() => setSettingsAvailable({ app: false, snapshot: false }));
  }

  useEffect(() => {
    fetch('/demo/templates')
      .then((r) => r.json() as Promise<Record<string, unknown>>)
      .then((data) => setKinds(Object.keys(data).sort()))
      .catch(() => setKinds([]));
    refreshWorking();
    refreshSettingsAvailability();
  }, []);

  function selectKind(kind: string) {
    setSelected(kind);
    setModalOpen(true);
    setValidation(null);
    setMessage(null);
    fetch(`/demo/templates/${kind}/placeholders`)
      .then((r) => r.json() as Promise<string[]>)
      .then((names) => {
        setPlaceholders(names);
        const remembered = kindForms[kind];
        setValues(remembered?.values ?? Object.fromEntries(names.map((n) => [n, DEFAULT_PATTERNS[n] ?? 'demo-{n}'])));
        setCount(remembered?.count ?? 3);
        if (kind === 'Node') setNodeMasterCount(remembered?.masterCount ?? 0);
      })
      .catch(() => setPlaceholders([]));
  }

  /** Remembers the just-edited Kind's form (so reopening it, or a later Settings save, sees this state) and
   *  closes the modal. Called both by the modal's own Close button and right after a successful generate. */
  function closeModal() {
    if (selected) {
      setKindForms((m) => ({
        ...m,
        [selected]: { count, values, ...(selected === 'Node' ? { masterCount: nodeMasterCount } : {}) },
      }));
    }
    setModalOpen(false);
  }

  function generateBody(): Record<string, unknown> {
    const body: Record<string, unknown> = { kind: selected, count, values };
    if (selected === 'Node') body.masterCount = nodeMasterCount;
    return body;
  }

  async function validate() {
    if (!selected) return;
    setValidating(true);
    setValidation(null);
    try {
      const res = await fetch('/demo/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(generateBody()),
      });
      const data = (await res.json()) as { error?: string; sample?: { metadata?: { name?: string } }[] };
      if (!res.ok) {
        setValidation({ ok: false, message: data.error ?? 'validation failed' });
        return;
      }
      const names = (data.sample ?? []).map((item) => item.metadata?.name ?? '?').join(' … ');
      setValidation({ ok: true, message: `Looks good — e.g. ${names}` });
    } catch (e) {
      setValidation({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setValidating(false);
    }
  }

  async function generate() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/demo/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(generateBody()),
      });
      const data = (await res.json()) as { error?: string; total?: number };
      if (!res.ok) throw new Error(data.error ?? 'generate failed');
      setMessage(`Added ${count} ${selected} (${data.total} total staged).`);
      refreshWorking();
      closeModal();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveDemoSettings() {
    setBusy(true);
    setSettingsMessage(null);
    try {
      const settings: DemoDataSettings = {
        bundleNamespace,
        additionalNamespaceCount,
        pvcPercent,
        servicePodPercent,
        serviceSharedPercent,
        podsPerNodePattern,
        failedPodCount,
        warningPodCount,
        cronJobPercent,
        statefulSetPercent,
        jobPercent,
        includeStandardLaunchEvents,
        podsPerGateway,
        httpRoutePercent,
        networkPolicyPercent,
        simulatePodChurn,
        podChurnPercent,
        kindForms,
      };
      const res = await fetch('/demo/settings/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = (await res.json()) as { ok: boolean; paths: string[] };
      setSettingsMessage(`Saved to ${data.paths.join(' and ')}.`);
      refreshSettingsAvailability();
    } catch (e) {
      setSettingsMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadDemoSettings(location: 'app' | 'snapshot') {
    setBusy(true);
    setSettingsMessage(null);
    try {
      const res = await fetch(`/demo/settings/load?location=${location}`);
      const data = (await res.json()) as Partial<DemoDataSettings> & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'load failed');
      setBundleNamespace(data.bundleNamespace ?? 'default');
      setAdditionalNamespaceCount(data.additionalNamespaceCount ?? 3);
      setPvcPercent(data.pvcPercent ?? 15);
      setServicePodPercent(data.servicePodPercent ?? 20);
      setServiceSharedPercent(data.serviceSharedPercent ?? 15);
      setPodsPerNodePattern(data.podsPerNodePattern ?? '{100-150,Random}');
      setFailedPodCount(data.failedPodCount ?? 5);
      setWarningPodCount(data.warningPodCount ?? 10);
      setCronJobPercent(data.cronJobPercent ?? 5);
      setStatefulSetPercent(data.statefulSetPercent ?? 5);
      setJobPercent(data.jobPercent ?? 10);
      setIncludeStandardLaunchEvents(data.includeStandardLaunchEvents ?? false);
      setPodsPerGateway(data.podsPerGateway ?? 100);
      setHttpRoutePercent(data.httpRoutePercent ?? 50);
      setNetworkPolicyPercent(data.networkPolicyPercent ?? 50);
      setSimulatePodChurn(data.simulatePodChurn ?? false);
      setPodChurnPercent(data.podChurnPercent ?? 10);
      setKindForms(data.kindForms ?? {});
      setSettingsMessage(`Loaded settings from the ${location === 'app' ? 'app directory' : 'snapshot directory'}.`);
    } catch (e) {
      setSettingsMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!finishName.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/demo/finish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: finishName.trim(), simulatePodChurn, podChurnPercent }),
      });
      const data = (await res.json()) as { error?: string; count?: number; file?: string };
      if (!res.ok) throw new Error(data.error ?? 'finish failed');
      setMessage(`Wrote ${data.count} resources to ${data.file} — switch snapshots to see it in the dropdown.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!confirm('Clear ALL staged demo data? This cannot be undone.')) return;
    await fetch('/demo/working', { method: 'DELETE' });
    refreshWorking();
  }

  // Every Bundle a checkbox can select — id/url/body match the server's /demo/bundles/* endpoints one-to-one.
  // `estimate` projects (from CURRENT field values + currently-staged Node/Namespace/Pod counts) roughly what
  // this bundle would add per Kind if run right now — several of these are inherently approximate (e.g. how
  // many currently-staged Pods are un-owned, or already have a Service label, isn't known client-side, only
  // the total Pod count is), so a [min, max] range is shown rather than a single number. Declared inline (not
  // hoisted) since every entry's body()/estimate() closes over the component's current field state.
  const nodeCount = working?.find((w) => w.kind === 'Node')?.count ?? 0;
  const namespaceCount = working?.find((w) => w.kind === 'Namespace')?.count ?? 0;
  const podCount = working?.find((w) => w.kind === 'Pod')?.count ?? 0;

  const BUNDLE_DEFS: {
    id: string;
    label: string;
    url: string;
    body: () => Record<string, unknown>;
    estimate: () => Partial<Record<string, [number, number]>>;
  }[] = [
    {
      id: 'namespaces',
      label: 'System + N Namespaces',
      url: '/demo/bundles/namespaces',
      body: () => ({ additionalCount: additionalNamespaceCount }),
      estimate: () => ({ Namespace: [additionalNamespaceCount, additionalNamespaceCount + 4] }),
    },
    {
      id: 'system-pods',
      label: 'System Pods (kube-system)',
      url: '/demo/bundles/system-pods',
      body: () => ({}),
      // Idempotent (skips names already staged), so the true count added could be as low as 0.
      estimate: () => ({ Pod: [0, 5] }),
    },
    {
      id: 'rbac',
      label: 'RBAC team (Role/ClusterRole/Bindings)',
      url: '/demo/bundles/rbac',
      body: () => ({ namespace: bundleNamespace }),
      estimate: () => ({ Role: [2, 2], ClusterRole: [2, 2], RoleBinding: [2, 2], ClusterRoleBinding: [2, 2] }),
    },
    {
      id: 'config-secrets',
      label: '5 ConfigMaps + 5 Secrets (every Namespace)',
      url: '/demo/bundles/config-secrets',
      body: () => ({}),
      // Idempotent per Namespace (skips ones that already have the pool), so the true count added could be
      // as low as 0.
      estimate: () => ({ ConfigMap: [0, namespaceCount * 5], Secret: [0, namespaceCount * 5] }),
    },
    {
      id: 'storage-csi',
      label: '3 StorageClasses + 3 CSIDrivers',
      url: '/demo/bundles/storage-csi',
      body: () => ({}),
      estimate: () => ({ StorageClass: [3, 3], CSIDriver: [3, 3] }),
    },
    {
      id: 'csi-node-sync',
      label: 'Sync CSINode ↔ Nodes',
      url: '/demo/bundles/csi-node-sync',
      body: () => ({}),
      estimate: () => ({ CSINode: [nodeCount, nodeCount] }),
    },
    {
      id: 'daemonsets',
      label: 'DaemonSets per Node (8-13)',
      url: '/demo/bundles/daemonsets',
      body: () => ({}),
      estimate: () => ({ DaemonSet: [8 * nodeCount, 13 * nodeCount], Pod: [8 * nodeCount, 13 * nodeCount] }),
    },
    {
      id: 'pods-per-node',
      label: 'Generate Pods per Node',
      url: '/demo/bundles/pods-per-node',
      body: () => ({ podsPerNodePattern, failedCount: failedPodCount, warningCount: warningPodCount }),
      estimate: () => {
        const [lo, hi] = parsePatternRange(podsPerNodePattern);
        const extra = failedPodCount + warningPodCount;
        return { Pod: [lo * nodeCount + extra, hi * nodeCount + extra] };
      },
    },
    {
      id: 'workloads',
      label: 'Generate CronJobs/StatefulSets/Jobs',
      url: '/demo/bundles/workloads',
      body: () => ({ cronJobPercent, statefulSetPercent, jobPercent }),
      estimate: () => {
        const cronJobs = Math.round((cronJobPercent / 100) * podCount);
        const jobs = Math.round((jobPercent / 100) * podCount);
        const statefulSets = Math.round((statefulSetPercent / 100) * podCount);
        return {
          CronJob: [cronJobs, cronJobs],
          Job: [jobs, jobs],
          StatefulSet: [statefulSets, statefulSets],
          Pod: [statefulSets, statefulSets * 3],
          PersistentVolumeClaim: [statefulSets, statefulSets * 3],
          PersistentVolume: [statefulSets, statefulSets * 3],
        };
      },
    },
    {
      // Runs after pods-per-node/workloads (not right after daemonsets) since it reads whatever Pods are
      // CURRENTLY staged and only wires up ones with no owner yet — running it earlier would miss the bulk
      // of Pods those two bundles are about to create, leaving them permanently un-owned.
      id: 'deployments',
      label: 'Deployments for un-owned Pods (1-5)',
      url: '/demo/bundles/deployments',
      body: () => ({}),
      // Upper bound assumes every staged Pod is currently un-owned (ownership isn't tracked client-side).
      estimate: () => ({ Deployment: [Math.ceil(podCount / 5), podCount], ReplicaSet: [Math.ceil(podCount / 5), podCount] }),
    },
    {
      // Also runs after pods-per-node/workloads for the same reason — it samples from currently-staged
      // Pods, so running it before the bulk of Pods exist would starve it down to near-zero PVC/PV pairs.
      id: 'pvc-pv',
      label: 'Generate PVCs + PVs',
      url: '/demo/bundles/pvc-pv',
      body: () => ({ percent: pvcPercent }),
      estimate: () => {
        const n = Math.round((pvcPercent / 100) * podCount);
        return { PersistentVolumeClaim: [n, n], PersistentVolume: [n, n], VolumeAttachment: [Math.floor(n / 2), Math.ceil(n / 2)] };
      },
    },
    {
      // Same reasoning — needs the full Pod population staged first.
      id: 'services',
      label: 'Generate Services',
      url: '/demo/bundles/services',
      body: () => ({ podPercent: servicePodPercent, sharedPercent: serviceSharedPercent }),
      estimate: () => {
        const selected = Math.round((servicePodPercent / 100) * podCount);
        const min = selected > 0 ? Math.ceil(selected / 4) : 0;
        return { Service: [min, selected], Endpoints: [min, selected] };
      },
    },
    {
      id: 'service-accounts',
      label: 'ServiceAccounts (as needed)',
      url: '/demo/bundles/service-accounts',
      body: () => ({}),
      // Skips Namespaces that already have one, so the true count could be as low as 0.
      estimate: () => ({ ServiceAccount: [0, namespaceCount] }),
    },
    {
      id: 'events',
      label: 'Generate Events',
      url: '/demo/bundles/events',
      body: () => ({ includeStandardLaunchEvents }),
      // Failed/Pending Pod counts aren't tracked client-side, only the total — shown as a range up to that total.
      estimate: () => (includeStandardLaunchEvents ? { Event: [podCount * 5, podCount * 6] } : { Event: [0, podCount] }),
    },
    {
      id: 'gateway',
      label: 'Generate Gateway/GatewayClass/HTTPRoute',
      url: '/demo/bundles/gateway',
      body: () => ({ podsPerGateway, httpRoutePercent }),
      estimate: () => {
        const gatewayCount = podCount > 0 && podsPerGateway > 0 ? Math.max(1, Math.floor(podCount / podsPerGateway)) : 0;
        const routesMax = Math.round((httpRoutePercent / 100) * podCount);
        return { Gateway: [gatewayCount, gatewayCount], GatewayClass: [gatewayCount, gatewayCount], HTTPRoute: [0, routesMax] };
      },
    },
    {
      id: 'network-policies',
      label: 'Generate NetworkPolicies',
      url: '/demo/bundles/network-policies',
      body: () => ({ percent: networkPolicyPercent }),
      estimate: () => {
        const n = Math.round((networkPolicyPercent / 100) * namespaceCount);
        return { NetworkPolicy: [n, n] };
      },
    },
    {
      id: 'quota-limits',
      label: 'ResourceQuota + LimitRange (all non-system Namespaces)',
      url: '/demo/bundles/quota-limits',
      body: () => ({}),
      estimate: () => {
        const n = Math.max(0, namespaceCount - 4);
        return { ResourceQuota: [n, n], LimitRange: [n, n] };
      },
    },
    {
      id: 'config-secret-refs',
      label: 'Reference a ConfigMap + Secret from every Pod',
      url: '/demo/bundles/config-secret-refs',
      body: () => ({}),
      // Idempotent (skips Pods that already have a ref) and only stages the pool in Namespaces that need it, so
      // the true count added could be as low as 0.
      estimate: () => ({ ConfigMap: [0, namespaceCount * 5], Secret: [0, namespaceCount * 5] }),
    },
  ];

  const bundleKinds = new Set(BUNDLE_DEFS.flatMap((d) => Object.keys(d.estimate())));

  /** Sums every CHECKED bundle's estimate for one Kind — null if no checked bundle touches it at all. */
  function estimateForKind(kind: string): [number, number] | null {
    let min = 0;
    let max = 0;
    let any = false;
    for (const def of BUNDLE_DEFS) {
      if (!checkedBundles[def.id]) continue;
      const range = def.estimate()[kind];
      if (!range) continue;
      min += range[0];
      max += range[1];
      any = true;
    }
    return any ? [min, max] : null;
  }

  function toggleBundle(id: string) {
    setCheckedBundles((m) => ({ ...m, [id]: !m[id] }));
  }

  async function generateCheckedBundles() {
    const toRun = BUNDLE_DEFS.filter((d) => checkedBundles[d.id]);
    if (toRun.length === 0) return;
    setBusy(true);
    setMessage(null);
    const results: string[] = [];
    for (const def of toRun) {
      try {
        const res = await fetch(def.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(def.body()),
        });
        const data = (await res.json()) as { error?: string; warning?: string; totals?: Record<string, number>; total?: number };
        if (!res.ok) {
          results.push(`${def.label}: ${data.error ?? 'failed'}`);
        } else if (data.warning) {
          results.push(`${def.label}: ${data.warning}`);
        } else if (data.totals) {
          results.push(`${def.label}: ${Object.entries(data.totals).map(([k, v]) => `${k} ${v}`).join(', ')}`);
        } else {
          results.push(`${def.label}: ${data.total}`);
        }
      } catch (e) {
        results.push(`${def.label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setMessage(results.join(' | '));
    refreshWorking();
    setBusy(false);
  }

  /**
   * Actually deletes whatever's currently staged for every Bundle-produced Kind that a CHECKED Bundle can
   * produce — not just "whatever that Bundle would add if run again". Deliberately keyed off `working` (the
   * real, currently-staged counts) rather than only the checked set, since the whole point is to remove data
   * a PREVIOUS run already created before you Generate again with new settings — un-checking a Bundle after
   * generating its data is a UI toggle, not a delete, so if this only looked at "currently checked" that
   * already-created data would silently survive (and Generate would stack more onto it) the moment you
   * unchecked the Bundle that made it. So: clear every Kind ANY Bundle-produced Kind that (a) a checked
   * Bundle can produce, OR (b) currently has ANY staged data at all — covering both "I'm about to regenerate
   * this" and "I un-checked this bundle but its old output is still sitting there".
   */
  async function clearCheckedBundleResources() {
    const checkedKinds = BUNDLE_DEFS.filter((d) => checkedBundles[d.id]).flatMap((d) => Object.keys(d.estimate()));
    const stagedBundleKinds = (working ?? []).filter((w) => w.count > 0 && bundleKinds.has(w.kind)).map((w) => w.kind);
    const kindsToClear = new Set([...checkedKinds, ...stagedBundleKinds]);
    if (kindsToClear.size === 0) return;
    if (!confirm(`Delete ALL currently-staged ${[...kindsToClear].sort().join(', ')}? This cannot be undone.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      for (const kind of kindsToClear) await fetch(`/demo/working?kind=${encodeURIComponent(kind)}`, { method: 'DELETE' });
      refreshWorking();
      const check = await fetch('/demo/working').then((r) => r.json() as Promise<WorkingSetEntry[]>);
      const stillThere = check.filter((w) => kindsToClear.has(w.kind) && w.count > 0);
      setMessage(
        stillThere.length === 0
          ? `Deleted staged data for ${kindsToClear.size} Kind${kindsToClear.size === 1 ? '' : 's'}.`
          : `Deleted staged data for ${kindsToClear.size} Kind(s), but ${stillThere.map((w) => `${w.kind} (${w.count})`).join(', ')} still show data — please retry.`,
      );
      setWorking(check);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-1 text-sm" style={{ color: 'var(--vpk-fg)' }}>
      <div className="flex items-center gap-2">
        <FlaskConical size={18} />
        <h2 className="text-base font-medium">Demo Data</h2>
      </div>
      <p style={{ color: 'var(--vpk-fg-muted)' }}>
        Pick a Kind below, fill in a pattern for each field, then generate. Items are staged in a working
        directory alongside your real snapshots; "Finish" merges everything staged into an actual snapshot
        file, at which point creation timestamps are assigned (staggered, ordered so e.g. Nodes predate Pods)
        and the resource hierarchy is checked.
      </p>
      <p style={{ color: 'var(--vpk-fg-muted)' }}>
        Pattern tokens: <code>{'{n}'}</code> is the 1-based item index (continues across separate "Add"
        clicks, so it never collides). <code>{'{from-to}'}</code> or <code>{'{from-to,step}'}</code> cycles
        SEQUENTIALLY through a range with wraparound, e.g. <code>{'{50-200}'}</code> or{' '}
        <code>{'{16-384,4}'}</code>. Two range tokens in ONE pattern odometer together — the rightmost cycles
        fastest and carries into the left one when it wraps, e.g. <code>{'10.0.{0-255}.{0-255}'}</code> walks
        65,536 unique addresses. <code>{'{from-to,Random}'}</code> instead draws a fresh uniformly-random
        integer each item, e.g. <code>{'{1-10,Random}'}</code>. <code>{'{guid}'}</code> generates a fresh
        random UUID per item, for identity-like fields; <code>{'{image}'}</code> generates a random{' '}
        <code>repo/name:tag</code> reference, one of three made-up demo registries per item;{' '}
        <code>{'{namespace}'}</code> round-robins through whatever Namespaces are currently staged, spreading
        generated items across all of them. A pattern with no tokens (e.g. <code>worker</code>) stays the
        same across every generated item.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded border p-3" style={{ borderColor: 'var(--vpk-border)' }}>
        <div className="font-medium">Settings</div>
        <button
          onClick={() => void saveDemoSettings()}
          disabled={busy}
          className="cursor-pointer rounded border px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          style={fieldStyle}
          title="Saves every Bundle field plus every Kind's last-used form to the app directory AND this snapshot directory's root"
        >
          Save settings
        </button>
        <button
          onClick={() => void loadDemoSettings('app')}
          disabled={busy || !settingsAvailable.app}
          className="cursor-pointer rounded border px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          style={fieldStyle}
          title="Loads whatever was last saved to the app directory — independent of which snapshot directory is currently configured"
        >
          Load app default
        </button>
        <button
          onClick={() => void loadDemoSettings('snapshot')}
          disabled={busy || !settingsAvailable.snapshot}
          className="cursor-pointer rounded border px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          style={fieldStyle}
          title="Loads whatever was last saved at the root of this snapshot directory"
        >
          Load from snapshot directory
        </button>
        {settingsMessage && <span style={{ color: 'var(--vpk-fg-muted)' }}>{settingsMessage}</span>}
      </div>

      <div className="flex flex-col gap-2 rounded border p-3" style={{ borderColor: 'var(--vpk-border)' }}>
        <div className="font-medium">Bundles</div>
        <p style={{ color: 'var(--vpk-fg-muted)' }}>
          Cross-Kind generators — several related Kinds staged together, reused across everything else you
          generate (the same fixed RBAC team, ConfigMap/Secret pool, StorageClass/CSIDriver pool every time),
          some reading whatever's already staged (Nodes, Pods, Namespaces) instead of a pattern you fill in
          yourself. Check the ones you want, fill in their fields, then click Generate once at the bottom — it
          runs every checked Bundle in a fixed dependency order (Namespaces, then Nodes-dependent ones, then
          Pod-count-dependent ones, ...).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="checkbox" checked={!!checkedBundles.namespaces} onChange={() => toggleBundle('namespaces')} />
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>additional namespaces</span>
            <input
              type="number"
              min={0}
              value={additionalNamespaceCount}
              onChange={(e) => setAdditionalNamespaceCount(Math.max(0, Number(e.target.value)))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
          <span title="Stages default/kube-system/kube-public/kube-node-lease (skipping any already staged) plus N freshly-named ones">
            System + N Namespaces
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={!!checkedBundles['system-pods']}
            onChange={() => toggleBundle('system-pods')}
            title="Every real cluster runs these in kube-system — kube-apiserver, kube-controller-manager, kube-scheduler, coredns, kube-proxy — created only as needed, scheduled onto a staged master Node if one exists"
          />
          <span>System Pods (kube-system)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="checkbox" checked={!!checkedBundles.rbac} onChange={() => toggleBundle('rbac')} />
          <span>RBAC team (Role/ClusterRole/Bindings)</span>
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>place Role/RoleBinding into namespace</span>
            <input
              value={bundleNamespace}
              onChange={(e) => setBundleNamespace(e.target.value)}
              placeholder="default"
              title="The single, literal namespace RBAC's Role/RoleBinding are created IN (ClusterRole/ClusterRoleBinding are cluster-scoped, unaffected) — not a prefix, and it doesn't create the namespace itself (use System + N Namespaces above for that)"
              className="w-28 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={!!checkedBundles['config-secrets']}
            onChange={() => toggleBundle('config-secrets')}
            title="Same fixed 5 ConfigMap + 5 Secret names reused in every currently-staged Namespace — created only as needed, skips a Namespace that already has them"
          />
          <span>5 ConfigMaps + 5 Secrets (every Namespace)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="checkbox" checked={!!checkedBundles['storage-csi']} onChange={() => toggleBundle('storage-csi')} />
          <span>3 StorageClasses + 3 CSIDrivers</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="checkbox" checked={!!checkedBundles['csi-node-sync']} onChange={() => toggleBundle('csi-node-sync')} />
          <span title="Refreshes CSINode to have one entry per currently-staged Node, listing all 3 CSI drivers">Sync CSINode ↔ Nodes</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="checkbox" checked={!!checkedBundles.daemonsets} onChange={() => toggleBundle('daemonsets')} />
          <span title="8-13 DaemonSets per currently-staged Node, randomly assigned, each with one owned Pod scheduled to it">
            DaemonSets per Node (8-13)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="checkbox" checked={!!checkedBundles.deployments} onChange={() => toggleBundle('deployments')} />
          <span title="Wires every un-owned staged Pod into a Deployment -> ReplicaSet (1-5 replicas, randomly picked) -> Pod chain">
            Deployments for un-owned Pods (1-5)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={!!checkedBundles['pvc-pv']}
            onChange={() => toggleBundle('pvc-pv')}
            title="PVCs + PVs — split 50/50 between StorageClass-backed and VolumeAttachment-backed PVs"
          />
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>% of Pods get a PVC</span>
            <input
              type="number"
              min={1}
              max={100}
              value={pvcPercent}
              onChange={(e) => setPvcPercent(Math.max(1, Math.min(100, Number(e.target.value))))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="checkbox" checked={!!checkedBundles.services} onChange={() => toggleBundle('services')} />
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>% of Pods get a Service</span>
            <input
              type="number"
              min={1}
              max={100}
              value={servicePodPercent}
              onChange={(e) => setServicePodPercent(Math.max(1, Math.min(100, Number(e.target.value))))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>% of Services shared</span>
            <input
              type="number"
              min={0}
              max={100}
              value={serviceSharedPercent}
              onChange={(e) => setServiceSharedPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={!!checkedBundles['pods-per-node']}
            onChange={() => toggleBundle('pods-per-node')}
            title="Failed and Warning (Pending) Pods are scattered across Worker Nodes only"
          />
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Pods per Node</span>
            <input
              type="text"
              value={podsPerNodePattern}
              onChange={(e) => setPodsPerNodePattern(e.target.value)}
              className="w-32 rounded border px-1.5 py-1"
              style={fieldStyle}
              title='Pattern, e.g. "{100-150,Random}" — resolved fresh per Node, split randomly into Running/Succeeded'
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Failed (cluster-wide)</span>
            <input
              type="number"
              min={0}
              value={failedPodCount}
              onChange={(e) => setFailedPodCount(Math.max(0, Number(e.target.value)))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Warning (cluster-wide)</span>
            <input
              type="number"
              min={0}
              value={warningPodCount}
              onChange={(e) => setWarningPodCount(Math.max(0, Number(e.target.value)))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={!!checkedBundles.workloads}
            onChange={() => toggleBundle('workloads')}
            title="Each percent is resolved against the same total staged Pod count. StatefulSets get 1-3 replicas each, with a real per-replica PVC + PV."
          />
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>% of Pods → CronJob</span>
            <input
              type="number"
              min={0}
              max={100}
              value={cronJobPercent}
              onChange={(e) => setCronJobPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>% of Pods → StatefulSet</span>
            <input
              type="number"
              min={0}
              max={100}
              value={statefulSetPercent}
              onChange={(e) => setStatefulSetPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>% of Pods → Job</span>
            <input
              type="number"
              min={0}
              max={100}
              value={jobPercent}
              onChange={(e) => setJobPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="checkbox" checked={!!checkedBundles['service-accounts']} onChange={() => toggleBundle('service-accounts')} />
          <span title="One ServiceAccount per currently-staged Namespace — created only as needed, skips Namespaces that already have one">
            ServiceAccounts (as needed)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={!!checkedBundles.events}
            onChange={() => toggleBundle('events')}
            title="Failed/Warning Pods always get a Warning Event; checking the box on the line below also adds the standard Scheduled/Pulling/Pulled/Created/Started sequence to every Pod"
          />
          <span>Events (Failed/Warning Pods)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={includeStandardLaunchEvents}
              onChange={(e) => setIncludeStandardLaunchEvents(e.target.checked)}
            />
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Include standard launch Events for every Pod</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={!!checkedBundles.gateway}
            onChange={() => toggleBundle('gateway')}
            title="One Gateway + one GatewayClass per N Pods; an HTTPRoute for the given percent of Pods that already have a Service (check the Services Bundle too)"
          />
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Pods per Gateway</span>
            <input
              type="number"
              min={1}
              value={podsPerGateway}
              onChange={(e) => setPodsPerGateway(Math.max(1, Number(e.target.value)))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>% of Pods-with-Service → HTTPRoute</span>
            <input
              type="number"
              min={0}
              max={100}
              value={httpRoutePercent}
              onChange={(e) => setHttpRoutePercent(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={!!checkedBundles['network-policies']}
            onChange={() => toggleBundle('network-policies')}
            title="A default-deny-ingress NetworkPolicy for the given percent of currently-staged Namespaces"
          />
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>% of Namespaces → NetworkPolicy</span>
            <input
              type="number"
              min={0}
              max={100}
              value={networkPolicyPercent}
              onChange={(e) => setNetworkPolicyPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-16 rounded border px-1.5 py-1"
              style={fieldStyle}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="checkbox" checked={!!checkedBundles['quota-limits']} onChange={() => toggleBundle('quota-limits')} />
          <span title="One ResourceQuota + one LimitRange for every non-system Namespace that doesn't already have one">
            ResourceQuota + LimitRange (all non-system Namespaces)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={!!checkedBundles['config-secret-refs']}
            onChange={() => toggleBundle('config-secret-refs')}
          />
          <span title="Gives every currently-staged Pod that doesn't already have one at least one ConfigMap and one Secret reference (via envFrom), staging the ConfigMap/Secret pool in any Namespace that needs it">
            Reference a ConfigMap + Secret from every Pod
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void generateCheckedBundles()}
            disabled={busy || !BUNDLE_DEFS.some((d) => checkedBundles[d.id])}
            className="w-fit cursor-pointer rounded px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--vpk-rail-active-bg)' }}
          >
            Generate
          </button>
          <button
            onClick={() => void clearCheckedBundleResources()}
            disabled={
              busy ||
              (!BUNDLE_DEFS.some((d) => checkedBundles[d.id]) && !(working ?? []).some((w) => w.count > 0 && bundleKinds.has(w.kind)))
            }
            className="w-fit cursor-pointer rounded border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            style={fieldStyle}
            title="Deletes ALREADY-STAGED data for every Kind a checked Bundle produces, plus any other Bundle-produced Kind that currently has data staged — adjust fields above, clear, then Generate for a result reflecting only the latest settings instead of stacking on a previous run's output"
          >
            Clear generated resources
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded border p-3" style={{ borderColor: 'var(--vpk-border)' }}>
        <div className="font-medium">Individual resources</div>
        <p style={{ color: 'var(--vpk-fg-muted)' }}>
          Generate one Kind directly with your own pattern per field — only Kinds no Bundle above ever touches
          (everything else lives in the collapsible "Bundle resources" section below). The number on a button
          is however many of that Kind are CURRENTLY staged.
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
          {(kinds ?? [])
            .filter((kind) => !bundleKinds.has(kind))
            .map((kind) => {
              const stagedCount = working?.find((w) => w.kind === kind)?.count ?? 0;
              return (
                <button
                  key={kind}
                  onClick={() => selectKind(kind)}
                  className="flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left"
                  style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-surface)', color: 'var(--vpk-fg)' }}
                >
                  <img src={iconUrlForKind(kind)} alt="" style={{ width: 16, height: 16 }} />
                  <span className="flex-1">{kind}</span>
                  {stagedCount > 0 && (
                    <span
                      className="rounded-full px-1.5 text-xs font-medium text-white"
                      style={{ background: 'var(--vpk-rail-active-bg)' }}
                    >
                      {stagedCount}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded border p-3" style={{ borderColor: 'var(--vpk-border)' }}>
        <button
          onClick={() => setBundleResourcesExpanded((v) => !v)}
          className="flex cursor-pointer items-center gap-1.5 text-left font-medium"
        >
          <span>{bundleResourcesExpanded ? '▾' : '▸'}</span>
          <span>Bundle resources ({(kinds ?? []).filter((k) => bundleKinds.has(k)).length})</span>
        </button>
        {bundleResourcesExpanded && (
          <>
            <p style={{ color: 'var(--vpk-fg-muted)' }}>
              Every Kind at least one Bundle above can produce — still generatable directly here too. The dark
              badge is however many are CURRENTLY staged; the lighter one is roughly how many the CHECKED
              Bundles above would ADD if you clicked Generate right now (a range where the true count can vary
              — e.g. DaemonSets per Node, or however many currently-staged Pods turn out to be un-owned).
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
              {(kinds ?? [])
                .filter((kind) => bundleKinds.has(kind))
                .map((kind) => {
                  const stagedCount = working?.find((w) => w.kind === kind)?.count ?? 0;
                  const estimate = estimateForKind(kind);
                  return (
                    <button
                      key={kind}
                      onClick={() => selectKind(kind)}
                      className="flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left"
                      style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-surface)', color: 'var(--vpk-fg)' }}
                    >
                      <img src={iconUrlForKind(kind)} alt="" style={{ width: 16, height: 16 }} />
                      <span className="flex-1">{kind}</span>
                      {stagedCount > 0 && (
                        <span
                          className="rounded-full px-1.5 text-xs font-medium text-white"
                          style={{ background: 'var(--vpk-rail-active-bg)' }}
                        >
                          {stagedCount}
                        </span>
                      )}
                      {estimate && (estimate[0] > 0 || estimate[1] > 0) && (
                        <span
                          className="rounded-full px-1.5 text-xs font-medium"
                          style={{ background: 'var(--vpk-surface)', border: '1px solid var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
                        >
                          +{formatRange(estimate)}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </>
        )}
      </div>

      {message && <p style={{ color: 'var(--vpk-fg)' }}>{message}</p>}

      {modalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div
            className="flex max-h-[85vh] w-[32rem] flex-col gap-2 overflow-y-auto rounded p-4"
            style={{ background: 'var(--vpk-surface)', border: '1px solid var(--vpk-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium">Generate {selected}</div>
              <button onClick={closeModal} className="cursor-pointer rounded border px-2 py-0.5 text-xs" style={fieldStyle}>
                Close
              </button>
            </div>

            {selected === 'Node' ? (
              <>
                <label className="flex items-center gap-2">
                  <span style={{ color: 'var(--vpk-fg-muted)' }}>Total Nodes</span>
                  <input
                    type="number"
                    min={1}
                    value={count}
                    onChange={(e) => {
                      const next = Math.max(1, Number(e.target.value));
                      setCount(next);
                      setNodeMasterCount((m) => Math.min(m, next));
                    }}
                    className="w-20 rounded border px-1.5 py-1"
                    style={fieldStyle}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span style={{ color: 'var(--vpk-fg-muted)' }}>Master Nodes (of the total above)</span>
                  <input
                    type="number"
                    min={0}
                    max={count}
                    value={nodeMasterCount}
                    onChange={(e) => setNodeMasterCount(Math.max(0, Math.min(count, Number(e.target.value))))}
                    className="w-20 rounded border px-1.5 py-1"
                    style={fieldStyle}
                  />
                </label>
                <p style={{ color: 'var(--vpk-fg-muted)' }}>
                  {nodeMasterCount} Master, {count - nodeMasterCount} Worker — role is set automatically per Node, not via a
                  pattern.
                </p>
              </>
            ) : (
              <label className="flex items-center gap-2">
                <span style={{ color: 'var(--vpk-fg-muted)' }}>Count</span>
                <input
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                  className="w-20 rounded border px-1.5 py-1"
                  style={fieldStyle}
                />
              </label>
            )}

            {placeholders.length === 0 && <p style={{ color: 'var(--vpk-fg-muted)' }}>This template has no fillable fields.</p>}
            {placeholders
              .filter((name) => !(selected === 'Node' && name === 'role'))
              .map((name) => (
                <label key={name} className="flex flex-col gap-0.5">
                  <span style={{ color: 'var(--vpk-fg-muted)' }}>{name}</span>
                  <input
                    value={values[name] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                    placeholder="literal value, or a pattern using {n}"
                    className="w-full rounded border px-1.5 py-1"
                    style={fieldStyle}
                  />
                </label>
              ))}

            {validation && (
              <p style={{ color: validation.ok ? 'var(--vpk-fg)' : '#b3413a' }}>{validation.message}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => void validate()}
                disabled={validating || busy}
                className="cursor-pointer rounded border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                style={fieldStyle}
                title="Resolves every pattern for this count WITHOUT staging anything — catches a malformed pattern or an out-of-range Master count up front"
              >
                {validating ? 'Validating…' : 'Validate'}
              </button>
              <button
                onClick={() => void generate()}
                disabled={busy}
                className="cursor-pointer rounded px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'var(--vpk-rail-active-bg)' }}
              >
                Add {count} to working set
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded border p-3" style={{ borderColor: 'var(--vpk-border)' }}>
        <div className="font-medium">Working set</div>
        {working === null && <p style={{ color: 'var(--vpk-fg-muted)' }}>Loading…</p>}
        {working !== null && working.length === 0 && <p style={{ color: 'var(--vpk-fg-muted)' }}>Nothing staged yet.</p>}
        {working !== null && working.length > 0 && (
          <ul className="flex flex-col gap-0.5">
            {working.map((w) => (
              <li key={w.kind}>
                {w.kind}: {w.count}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={simulatePodChurn} onChange={(e) => setSimulatePodChurn(e.target.checked)} />
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Simulate pod churn (Wheel timelapse)</span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={podChurnPercent}
            onChange={(e) => setPodChurnPercent(Number(e.target.value))}
            disabled={!simulatePodChurn}
            title="% of eligible (non-DaemonSet) Pods that get a synthetic replacement event during the timestamp window"
            className="w-16 rounded border px-1.5 py-1 disabled:opacity-50"
            style={fieldStyle}
          />
          <span style={{ color: 'var(--vpk-fg-muted)' }}>% of Pods</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={finishName}
            onChange={(e) => setFinishName(e.target.value)}
            placeholder="snapshot name"
            className="rounded border px-1.5 py-1"
            style={fieldStyle}
          />
          <button
            onClick={() => void finish()}
            disabled={busy || !finishName.trim() || !working?.length}
            className="cursor-pointer rounded px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--vpk-rail-active-bg)' }}
          >
            Finish → Snapshot
          </button>
          <button
            onClick={() => void clearAll()}
            disabled={busy || !working?.length}
            className="cursor-pointer rounded border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            style={fieldStyle}
          >
            Clear working set
          </button>
        </div>
      </div>
    </div>
  );
}
