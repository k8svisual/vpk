import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type { PureCheck, StepResult } from '@vpk/training';
import { runStepLive } from './liveCheck';

function clusterUp(): boolean {
  try {
    execSync('kubectl get --raw=/livez', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Deliberately READ-ONLY against the live cluster (never creates/deletes anything) — unlike the eventual
// production feature (a signed-off, opt-in mutating mode, see redesign/training-course.md §1), an automated
// test suite mutating the developer's actual local cluster on every `bun run test` run is a materially
// different, unattended action that wasn't specifically asked for. A real create-a-namespace-and-watch-it-
// converge test belongs with the fixture/lifecycle manager (§12), which is explicitly a later slice.
describe.skipIf(!clusterUp())('runStepLive (live cluster, read-only)', () => {
  it('captures + probes + evaluates against the real cluster: a trivially-true ClusterCheck passes', async () => {
    const checks: PureCheck[] = [{ id: 'nodes', kind: 'cluster', describe: 'at least 1 node Ready', assert: { nodesReady: 1 } }];
    const result = await runStepLive(checks, { cli: ['kubectl'], policy: { strictness: 'loose', passWhen: 'functional', floor: 'loose' } });
    expect(result.status).toBe('pass');
    expect(result.level).toBe('matched');
    expect(result.checks[0]?.functional).toBe('working');
  });

  it('polls on a real interval until timeout for a check that can never pass, calling onProgress each time', async () => {
    const checks: PureCheck[] = [{ id: 'nodes', kind: 'cluster', describe: 'implausibly many nodes', assert: { nodesReady: 999 } }];
    const progressCalls: StepResult[] = [];
    const start = Date.now();
    const result = await runStepLive(checks, {
      cli: ['kubectl'],
      policy: { strictness: 'loose', passWhen: 'functional', floor: 'loose' },
      timeoutMs: 350,
      pollMs: 100,
      onProgress: (r) => progressCalls.push(r),
    });
    const elapsed = Date.now() - start;
    expect(result.status).toBe('fail');
    expect(progressCalls.length).toBeGreaterThan(1); // proves it actually re-evaluated more than once
    expect(elapsed).toBeGreaterThanOrEqual(300); // didn't bail out early
    expect(elapsed).toBeLessThan(3000); // didn't hang past the deadline either
  }, 10_000);

  it('returns contextReachable: false gracefully (no throw) for a bogus context, rather than rejecting', async () => {
    const checks: PureCheck[] = [{ id: 'reach', kind: 'cluster', describe: 'reachable', assert: 'contextReachable' }];
    const result = await runStepLive(checks, {
      cli: ['kubectl', '--context', 'definitely-does-not-exist'],
      policy: { strictness: 'loose', passWhen: 'functional', floor: 'loose' },
    });
    expect(result.status).toBe('fail');
    expect(result.checks[0]?.functional).toBe('broken');
  });
});
