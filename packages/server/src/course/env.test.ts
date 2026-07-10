import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type { RawObject } from '@vpk/core';
import { detectProvisioner, isNodeReady, probeClusterFacts } from './env';

function clusterUp(): boolean {
  try {
    execSync('kubectl get --raw=/livez', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('isNodeReady', () => {
  it('true when a Ready condition is status True', () => {
    const node: RawObject = { status: { conditions: [{ type: 'Ready', status: 'True' }] } };
    expect(isNodeReady(node)).toBe(true);
  });

  it('false when Ready is status False', () => {
    const node: RawObject = { status: { conditions: [{ type: 'Ready', status: 'False' }] } };
    expect(isNodeReady(node)).toBe(false);
  });

  it('false when there is no Ready condition at all', () => {
    const node: RawObject = { status: { conditions: [{ type: 'MemoryPressure', status: 'False' }] } };
    expect(isNodeReady(node)).toBe(false);
  });

  it('false when status is entirely absent', () => {
    expect(isNodeReady({})).toBe(false);
  });
});

describe('detectProvisioner', () => {
  it('recognizes docker-desktop by its default context name and reports single-node only', () => {
    expect(detectProvisioner('docker-desktop')).toEqual({ provisioner: 'docker-desktop', multiNode: false });
  });

  it('recognizes k3d by its "k3d-" context prefix', () => {
    expect(detectProvisioner('k3d-mycluster')).toEqual({ provisioner: 'k3d', multiNode: true });
  });

  it('recognizes minikube (bare or profile-prefixed)', () => {
    expect(detectProvisioner('minikube')).toEqual({ provisioner: 'minikube', multiNode: true });
    expect(detectProvisioner('minikube-2')).toEqual({ provisioner: 'minikube', multiNode: true });
  });

  it('recognizes microk8s', () => {
    expect(detectProvisioner('microk8s')).toEqual({ provisioner: 'microk8s', multiNode: true });
  });

  it('falls back to external (permissive: multiNode true) for an unrecognized context name', () => {
    expect(detectProvisioner('my-companys-eks-cluster')).toEqual({ provisioner: 'external', multiNode: true });
  });
});

describe.skipIf(!clusterUp())('probeClusterFacts (live cluster)', () => {
  it('reads real cluster facts: reachable, at least one Ready node, a server version', async () => {
    const facts = await probeClusterFacts(['kubectl']);
    expect(facts.contextReachable).toBe(true);
    expect(facts.nodes.total).toBeGreaterThan(0);
    expect(facts.nodes.ready).toBeGreaterThan(0);
    expect(facts.serverVersion).toMatch(/^v?\d+\.\d+/);
    expect(facts.contextName).toBeTruthy();
  });

  it('reports contextReachable: false, never throws, for a CLI pointed at a nonexistent context', async () => {
    const facts = await probeClusterFacts(['kubectl', '--context', 'definitely-does-not-exist']);
    expect(facts.contextReachable).toBe(false);
    expect(facts.nodes).toEqual({ total: 0, ready: 0 });
  });
});
