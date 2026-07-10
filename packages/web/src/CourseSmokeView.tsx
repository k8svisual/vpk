import { useState } from 'react';
import { Terminal } from 'lucide-react';

/**
 * Training Course wiring smoke test (redesign/training-course.md) — NOT the real terminal/lesson UI. Its
 * only job is to prove the three server pieces built so far (/course/env, /course/command, /course/check)
 * actually work end-to-end from the browser against a live cluster, before any design work goes into what
 * the real terminal/lesson experience should look like. Deliberately unstyled/minimal on purpose — see
 * DemoDataView for this app's usual polish level; this view intentionally doesn't try to match it yet.
 */

// Local wire-shape types (thin-client convention — @vpk/web never imports @vpk/core, see kindColors.ts etc.
// for the same pattern elsewhere in this file's siblings).
interface ClusterFacts {
  contextReachable: boolean;
  contextName?: string;
  serverVersion?: string;
  nodes: { total: number; ready: number };
  provisioner?: string;
  capabilities: { multiNode: boolean };
}
interface CommandResult {
  argv: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}
interface StepResult {
  status: 'pass' | 'fail';
  level: string;
  checks: Array<{ id: string; functional: string; conformance: string; summary: string }>;
  feedback: Array<{ severity: 'blocker' | 'difference' | 'tip'; message: string }>;
}
type CheckStreamEvent = { type: 'progress' | 'done'; result: StepResult } | { type: 'error'; error: string } | { type: 'cancelled' };

// Read-only verbs only — this smoke test never mutates the cluster.
const READ_ONLY_ALLOW = ['get', 'describe', 'logs'];

const panelStyle = { borderColor: 'var(--vpk-border)' } as const;
const errorStyle = { color: 'var(--vpk-status-error, #c0392b)' } as const;
const mutedStyle = { color: 'var(--vpk-fg-muted)' } as const;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json()) as T | { error: string };
  if (json && typeof json === 'object' && 'error' in json) throw new Error((json as { error: string }).error);
  return json as T;
}

export function CourseSmokeView() {
  const [facts, setFacts] = useState<ClusterFacts | null>(null);
  const [factsError, setFactsError] = useState<string | null>(null);
  const [loadingFacts, setLoadingFacts] = useState(false);

  const [commandLine, setCommandLine] = useState('kubectl get nodes');
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [runningCommand, setRunningCommand] = useState(false);

  const [checkEvents, setCheckEvents] = useState<CheckStreamEvent[]>([]);
  const [runningCheck, setRunningCheck] = useState(false);

  async function refreshFacts() {
    setLoadingFacts(true);
    setFactsError(null);
    try {
      setFacts(await postJson<ClusterFacts>('/course/env', {}));
    } catch (e) {
      setFactsError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoadingFacts(false);
    }
  }

  async function runCommand() {
    setRunningCommand(true);
    setCommandError(null);
    setCommandResult(null);
    try {
      setCommandResult(await postJson<CommandResult>('/course/command', { line: commandLine, allow: READ_ONLY_ALLOW }));
    } catch (e) {
      setCommandError(String(e instanceof Error ? e.message : e));
    } finally {
      setRunningCommand(false);
    }
  }

  // Same NDJSON-over-fetch consumption pattern as CaptureConfirmModal's /capture stream — split on newlines
  // as chunks arrive so progress shows WHILE the check (re-)evaluates, not just once at the end.
  async function runCheck() {
    setRunningCheck(true);
    setCheckEvents([]);
    try {
      const res = await fetch('/course/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          checks: [
            { id: 'nodes', kind: 'cluster', describe: 'At least 1 node Ready', assert: { nodesReady: 1 } },
            {
              id: 'kube-system',
              kind: 'inventory',
              describe: 'kube-system inventory (informational — expects nothing, just shows the real diff)',
              namespace: 'kube-system',
              expect: { source: 'literal', value: {} },
            },
          ],
          policy: { strictness: 'loose', passWhen: 'functional', floor: 'loose' },
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('no response stream');
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          setCheckEvents((p) => [...p, JSON.parse(line) as CheckStreamEvent]);
        }
      }
    } catch (e) {
      setCheckEvents((p) => [...p, { type: 'error', error: String(e instanceof Error ? e.message : e) }]);
    } finally {
      setRunningCheck(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Terminal size={16} /> Training Course — wiring smoke test
        </h2>
        <p className="text-xs mt-1" style={mutedStyle}>
          Not the real UI — proves /course/env, /course/command, and /course/check work end-to-end against
          your live cluster before any design work on the actual terminal/lesson experience.
        </p>
      </div>

      <section className="border rounded p-3" style={panelStyle}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Cluster facts (/course/env)</h3>
          <button onClick={() => void refreshFacts()} disabled={loadingFacts} className="text-xs px-2 py-1 rounded border cursor-pointer disabled:cursor-not-allowed" style={panelStyle}>
            {loadingFacts ? 'Probing…' : 'Probe'}
          </button>
        </div>
        {factsError && (
          <p className="text-xs mt-2" style={errorStyle}>
            {factsError}
          </p>
        )}
        {facts && (
          <pre className="text-xs mt-2 overflow-auto" style={mutedStyle}>
            {JSON.stringify(facts, null, 2)}
          </pre>
        )}
      </section>

      <section className="border rounded p-3" style={panelStyle}>
        <h3 className="text-sm font-medium mb-2">Command runner (/course/command) — read-only verbs only ({READ_ONLY_ALLOW.join(', ')})</h3>
        <div className="flex gap-2">
          <input
            value={commandLine}
            onChange={(e) => setCommandLine(e.target.value)}
            className="flex-1 text-xs px-2 py-1 rounded border font-mono"
            style={{ ...panelStyle, background: 'var(--vpk-surface)' }}
          />
          <button onClick={() => void runCommand()} disabled={runningCommand} className="text-xs px-2 py-1 rounded border cursor-pointer disabled:cursor-not-allowed" style={panelStyle}>
            {runningCommand ? 'Running…' : 'Run'}
          </button>
        </div>
        {commandError && (
          <p className="text-xs mt-2" style={errorStyle}>
            {commandError}
          </p>
        )}
        {commandResult && (
          <div className="text-xs mt-2 font-mono">
            <div>
              exit code: {commandResult.exitCode ?? 'aborted'} ({commandResult.durationMs}ms)
            </div>
            {commandResult.stdout && <pre className="whitespace-pre-wrap mt-1">{commandResult.stdout}</pre>}
            {commandResult.stderr && (
              <pre className="whitespace-pre-wrap mt-1" style={errorStyle}>
                {commandResult.stderr}
              </pre>
            )}
          </div>
        )}
      </section>

      <section className="border rounded p-3" style={panelStyle}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Live check (/course/check) — hardcoded demo checks</h3>
          <button onClick={() => void runCheck()} disabled={runningCheck} className="text-xs px-2 py-1 rounded border cursor-pointer disabled:cursor-not-allowed" style={panelStyle}>
            {runningCheck ? 'Running…' : 'Run checks'}
          </button>
        </div>
        <div className="text-xs mt-2 space-y-2">
          {checkEvents.map((evt, i) => (
            <pre key={i} className="overflow-auto" style={mutedStyle}>
              {JSON.stringify(evt, null, 2)}
            </pre>
          ))}
        </div>
      </section>
    </div>
  );
}
