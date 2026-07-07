import { spawn } from 'node:child_process';
import type { RawObject } from '@vpk/core';
import { redactSecret, redactConfigMap } from '../redact';

/**
 * Capture a snapshot by invoking the user's kubectl-compatible CLI (DESIGN §4.2). Uses `spawn` with
 * argv arrays — NO shell — so nothing (kind names, the configured command) can inject. Discovery-driven:
 * only kinds the cluster actually has are fetched.
 */
export interface CaptureOptions {
  /** The CLI as argv, e.g. ['kubectl'], ['oc'], or ['ssh', 'host', 'kubectl']. Default ['kubectl']. */
  cli?: string[];
  /** Keep each Secret's `.data`/`.stringData` payload in the captured snapshot. Default true — set false to
   *  permanently discard it at capture time (baked in as the "not available" message, not just hidden by a
   *  display setting). The Secret's own definition — kind, metadata, type — is ALWAYS captured either way;
   *  VpK never skips fetching a resource kind wholesale, so this only ever affects the data payload. */
  keepSecretData?: boolean;
  /** Same idea as `keepSecretData`, one kind over: keep each ConfigMap's `.data`/`.binaryData` payload.
   *  Default true. A ConfigMap isn't a Secret, but it routinely carries sensitive text anyway (embedded
   *  certs, connection strings), so "Capture from cluster" offers this as an independent choice. */
  keepConfigMapData?: boolean;
}

export interface CaptureResult {
  items: RawObject[];
  manifest: { vpkSnapshot: number; captured: string; cluster: string; kinds: number };
}

// Core capture scope (§4.2b), as `get`-usable resource names. Availability is checked before fetching.
const CORE_NS = [
  'pods', 'replicasets', 'deployments', 'statefulsets', 'daemonsets', 'jobs', 'cronjobs',
  'controllerrevisions', 'services', 'endpoints', 'endpointslices', 'ingresses', 'networkpolicies',
  'configmaps', 'secrets', 'serviceaccounts', 'horizontalpodautoscalers', 'poddisruptionbudgets',
  'resourcequotas', 'limitranges', 'persistentvolumeclaims', 'roles', 'rolebindings', 'events',
  'gateways', 'httproutes', 'volumesnapshots',
];
const CORE_CLUSTER = [
  'nodes', 'namespaces', 'persistentvolumes', 'storageclasses', 'csidrivers', 'csinodes',
  'volumeattachments', 'ingressclasses', 'clusterroles', 'clusterrolebindings',
  'customresourcedefinitions', 'apiservices', 'gatewayclasses', 'volumesnapshotclasses',
];
export async function captureCore(opts: CaptureOptions = {}): Promise<CaptureResult> {
  const cli = opts.cli ?? ['kubectl'];
  const keepSecretData = opts.keepSecretData ?? true;
  const keepConfigMapData = opts.keepConfigMapData ?? true;

  const [nsAvail, clAvail, cluster] = await Promise.all([
    apiResourceNames(cli, true),
    apiResourceNames(cli, false),
    currentContext(cli),
  ]);
  // Secrets are ALWAYS fetched — never excluded from the kind list itself. keepSecretData only controls
  // whether the payload survives `trim()` below, never whether the object is captured at all.
  const nsKinds = CORE_NS.filter((k) => nsAvail.has(k));
  const clKinds = CORE_CLUSTER.filter((k) => clAvail.has(k));

  const raw: RawObject[] = [];
  if (nsKinds.length) raw.push(...(await getKinds(cli, nsKinds, true)));
  if (clKinds.length) raw.push(...(await getKinds(cli, clKinds, false)));

  const items = raw.map((o) => trim(o, keepSecretData, keepConfigMapData));
  return {
    items,
    manifest: {
      vpkSnapshot: 2,
      captured: new Date().toISOString(),
      cluster,
      kinds: nsKinds.length + clKinds.length,
    },
  };
}

function trim(obj: RawObject, keepSecretData: boolean, keepConfigMapData: boolean): RawObject {
  let out = obj;
  if (obj.metadata && obj.metadata.managedFields !== undefined) {
    const metadata = { ...obj.metadata };
    delete metadata.managedFields;
    out = { ...out, metadata };
  }
  if (!keepSecretData) out = redactSecret(out);
  if (!keepConfigMapData) out = redactConfigMap(out);
  return out;
}

async function apiResourceNames(cli: string[], namespaced: boolean): Promise<Set<string>> {
  try {
    const flag = namespaced ? '--namespaced=true' : '--namespaced=false';
    const out = await runCli([...cli, 'api-resources', flag, '-o', 'name']);
    const set = new Set<string>();
    for (const line of out.split('\n')) {
      const name = line.trim();
      if (name) set.add(name.split('.')[0] ?? name);
    }
    return set;
  } catch {
    return new Set();
  }
}

async function getKinds(cli: string[], kinds: string[], namespaced: boolean): Promise<RawObject[]> {
  const args = [...cli, 'get', kinds.join(','), '-o', 'json', ...(namespaced ? ['-A'] : [])];
  const doc = JSON.parse(await runCli(args)) as { items?: RawObject[] };
  return doc.items ?? [];
}

async function currentContext(cli: string[]): Promise<string> {
  try {
    return (await runCli([...cli, 'config', 'current-context'])).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Run a CLI (argv array, no shell). Resolves stdout on exit 0, rejects with stderr otherwise. */
function runCli(argv: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = argv;
    if (!cmd) {
      reject(new Error('empty command'));
      return;
    }
    const child = spawn(cmd, args);
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim() || `${cmd} exited ${code}`))));
  });
}
