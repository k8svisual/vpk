import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { checkCommandPolicy, probeBinary, runCourseCommand, tokenizeCommand } from './command';

function clusterUp(): boolean {
  try {
    execSync('kubectl get --raw=/livez', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('tokenizeCommand', () => {
  it('splits on whitespace', () => {
    expect(tokenizeCommand('kubectl get pods -n default')).toEqual(['kubectl', 'get', 'pods', '-n', 'default']);
  });

  it('collapses repeated whitespace', () => {
    expect(tokenizeCommand('kubectl   get    pods')).toEqual(['kubectl', 'get', 'pods']);
  });

  it('keeps a single-quoted argument as one token, including internal spaces', () => {
    expect(tokenizeCommand("kubectl get pods -o jsonpath='{.items[0].metadata.name}'")).toEqual(['kubectl', 'get', 'pods', '-o', 'jsonpath={.items[0].metadata.name}']);
  });

  it('keeps a double-quoted argument as one token', () => {
    expect(tokenizeCommand('kubectl label pod web "app.kubernetes.io/name=web app"')).toEqual(['kubectl', 'label', 'pod', 'web', 'app.kubernetes.io/name=web app']);
  });

  it('rejects pipes, redirects, and command chaining', () => {
    expect(() => tokenizeCommand('kubectl get pods | grep web')).toThrow(/Shell operators/);
    expect(() => tokenizeCommand('kubectl get pods > out.txt')).toThrow(/Shell operators/);
    expect(() => tokenizeCommand('kubectl get pods && kubectl delete pods --all')).toThrow(/Shell operators/);
  });

  it('rejects command substitution', () => {
    expect(() => tokenizeCommand('kubectl get $(whoami)')).toThrow(/Shell operators/);
  });

  it('throws on an unterminated quote', () => {
    expect(() => tokenizeCommand("kubectl get pods -l 'app=web")).toThrow(/Unterminated quote/);
  });

  it('returns an empty array for a blank line', () => {
    expect(tokenizeCommand('   ')).toEqual([]);
  });
});

describe('checkCommandPolicy', () => {
  const cli = ['kubectl'];
  const readOnly = { allow: ['get', 'describe', 'logs'] };

  it('allows a command whose verb is on the allow list', () => {
    expect(checkCommandPolicy(['kubectl', 'get', 'pods'], cli, readOnly)).toEqual({ allowed: true });
  });

  it('rejects a verb not on the allow list', () => {
    const decision = checkCommandPolicy(['kubectl', 'delete', 'pod', 'web'], cli, readOnly);
    expect(decision.allowed).toBe(false);
  });

  it('rejects a command starting with a different binary entirely', () => {
    const decision = checkCommandPolicy(['rm', '-rf', '/'], cli, { allow: ['get'] });
    expect(decision.allowed).toBe(false);
  });

  it('rejects an empty command', () => {
    expect(checkCommandPolicy([], cli, readOnly)).toEqual({ allowed: false, reason: 'Empty command.' });
  });

  // VpK's terminal is a training tool for real Kubernetes on the student's own cluster: destructive operations
  // are intentionally permitted when the lesson's `allow` list includes the verb (the terminal confirms a
  // `delete` in the UI instead of the server refusing it). These document that there is NO server-side
  // destructive-operation block beyond the verb gate.
  it('allows deleting a Node when the lesson allows delete (training tool, student cluster)', () => {
    const permissive = { allow: ['delete'] };
    expect(checkCommandPolicy(['kubectl', 'delete', 'node', 'minikube'], cli, permissive).allowed).toBe(true);
    expect(checkCommandPolicy(['kubectl', 'delete', 'no', 'worker-1'], cli, permissive).allowed).toBe(true);
  });

  it('allows a mutating verb with --all-namespaces when the verb is allowed', () => {
    const permissive = { allow: ['delete', 'apply'] };
    expect(checkCommandPolicy(['kubectl', 'delete', 'pods', '--all', '-A'], cli, permissive).allowed).toBe(true);
    expect(checkCommandPolicy(['kubectl', 'apply', '-f', 'x.yaml', '--all-namespaces'], cli, permissive).allowed).toBe(true);
    expect(checkCommandPolicy(['kubectl', 'delete', 'pods', '--all-namespaces=true'], cli, permissive).allowed).toBe(true);
  });

  it('still blocks a verb that is not on the allow list, destructive or not', () => {
    expect(checkCommandPolicy(['kubectl', 'delete', 'node', 'minikube'], cli, readOnly).allowed).toBe(false);
  });

  it('allows a whole binary on extraBinaries, bypassing the cli/verb gate entirely', () => {
    expect(checkCommandPolicy(['grep', '-r', 'foo', '.'], cli, { allow: [], extraBinaries: ['grep'] })).toEqual({ allowed: true });
  });

  it('matches extraBinaries against a resolved path, not just a bare name', () => {
    expect(checkCommandPolicy(['/usr/bin/jq', '.foo'], cli, { allow: [], extraBinaries: ['/usr/bin/jq'] }).allowed).toBe(true);
  });

  it('still rejects a binary that is neither cli nor on extraBinaries', () => {
    expect(checkCommandPolicy(['curl', 'https://example.com'], cli, { allow: ['get'], extraBinaries: ['grep', 'jq'] }).allowed).toBe(false);
  });
});

describe('probeBinary', () => {
  it('resolves true for a real binary on PATH', async () => {
    // Every POSIX box this runs on has `ls` — a stand-in for kubectl/oc without depending on either being
    // installed in the test environment.
    expect(await probeBinary('ls')).toBe(true);
  });

  it('resolves false for a binary name that does not exist', async () => {
    expect(await probeBinary('vpk-totally-not-a-real-binary')).toBe(false);
  });

  it('resolves false immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const start = Date.now();
    expect(await probeBinary('ls', controller.signal)).toBe(false);
    expect(Date.now() - start).toBeLessThan(50);
  });
});

describe.skipIf(!clusterUp())('runCourseCommand (live cluster)', () => {
  it('runs a real kubectl command and returns structured stdout + exit code', async () => {
    const result = await runCourseCommand(['kubectl', 'get', 'nodes']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('NAME');
    expect(result.stderr).toBe('');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('captures a non-zero exit and stderr instead of throwing — a typo is normal input, not a crash', async () => {
    const result = await runCourseCommand(['kubectl', 'get', 'totallynotarealkind']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('resolves immediately without spawning when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const start = Date.now();
    const result = await runCourseCommand(['kubectl', 'get', 'nodes'], controller.signal);
    expect(Date.now() - start).toBeLessThan(50); // no real subprocess ran
    expect(result.exitCode).toBeNull();
  });
});
