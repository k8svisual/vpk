import type { ClusterFacts, RawObject } from '@vpk/core';
import { currentContext, getOneKind, runCli } from '../capture/cliSource';

/**
 * Environment/cluster-facts probe (redesign/training-course.md §7.1's ClusterFacts, §9's Lesson-Zero
 * `vpk-detect`) — the live-I/O counterpart to @vpk/core/course's pure evaluators. Extends the existing
 * `/capture/validate` "can this CLI even run" check into the fuller read a ClusterCheck and the Lesson-Zero
 * recommender both need: is a context actually reachable, how many nodes are Ready, what provisioner is this,
 * can it do multiple nodes at all.
 */

export function isNodeReady(node: RawObject): boolean {
  const conditions = (node.status as { conditions?: Array<{ type?: string; status?: string }> } | undefined)?.conditions ?? [];
  return conditions.some((c) => c.type === 'Ready' && c.status === 'True');
}

/**
 * Provisioner + multi-node capability, inferred from the current context's NAME — not a live probe of the
 * `minikube`/`k3d`/`microk8s` binaries themselves. Deliberately so: a name-based read never risks hanging or
 * erroring on a binary that isn't installed (a student may be on Docker Desktop with none of the others
 * present), and every supported provisioner's default context naming is stable enough to key off
 * ('docker-desktop', 'minikube'/'minikube'-prefixed for multi-profile setups, 'k3d-'-prefixed, 'microk8s').
 * A context renamed away from its default defeats this and falls through to 'external' (multiNode: true,
 * the permissive assumption for an unrecognized cluster) — sharpening this into a real `minikube status`-
 * style probe is a reasonable follow-up if the naming heuristic proves unreliable in practice.
 */
export function detectProvisioner(contextName: string): { provisioner: ClusterFacts['provisioner']; multiNode: boolean } {
  if (contextName === 'docker-desktop') return { provisioner: 'docker-desktop', multiNode: false };
  if (contextName.startsWith('k3d-')) return { provisioner: 'k3d', multiNode: true };
  if (contextName === 'minikube' || contextName.startsWith('minikube')) return { provisioner: 'minikube', multiNode: true };
  if (contextName === 'microk8s') return { provisioner: 'microk8s', multiNode: true };
  return { provisioner: 'external', multiNode: true };
}

async function probeServerVersion(cli: string[], signal?: AbortSignal): Promise<string | undefined> {
  try {
    const raw = await runCli([...cli, 'version', '-o', 'json'], signal);
    const parsed = JSON.parse(raw) as { serverVersion?: { gitVersion?: string } };
    return parsed.serverVersion?.gitVersion;
  } catch {
    return undefined; // older kubectl, a CLI that doesn't support -o json, or genuinely unreachable — non-fatal
  }
}

/** Builds a full ClusterFacts read. Never throws — an unreachable cluster shows up as `contextReachable:
 *  false` with everything else best-effort/undefined, exactly the shape a ClusterCheck needs to report a
 *  useful "not reachable yet" rather than blow up the whole check run. */
export async function probeClusterFacts(cli: string[], signal?: AbortSignal): Promise<ClusterFacts> {
  const context = await currentContext(cli, signal);

  let nodes: RawObject[] = [];
  let contextReachable = true;
  try {
    nodes = await getOneKind(cli, 'nodes', false, signal);
  } catch {
    contextReachable = false;
  }

  const serverVersion = contextReachable ? await probeServerVersion(cli, signal) : undefined;
  const { provisioner, multiNode } = detectProvisioner(context);

  return {
    contextReachable,
    contextName: context === 'unknown' ? undefined : context,
    serverVersion,
    nodes: { total: nodes.length, ready: nodes.filter(isNodeReady).length },
    provisioner,
    capabilities: { multiNode },
  };
}
