import { describe, expect, it } from 'vitest';
import { ANSI_PALETTES, hasAnsi, highlightLine, isHeaderLine, parseAnsiRuns, type Span } from './terminalHighlight';

// Pull just the classified (non-plain, non-whitespace) tokens out of a highlighted line, so a test can assert
// "this token got that color" without pinning the exact whitespace spans in between.
function classified(line: string): Array<[string, Span['kind']]> {
  return highlightLine(line)
    .filter((s) => s.kind !== 'plain' && s.text.trim() !== '')
    .map((s) => [s.text, s.kind]);
}

describe('isHeaderLine', () => {
  it('detects an all-caps column header', () => {
    expect(isHeaderLine('NAME              STATUS   ROLES          AGE   VERSION')).toBe(true);
  });
  it('does not treat a data row as a header', () => {
    expect(isHeaderLine('vpk-test-worker   Ready    <none>         16h   v1.36.1')).toBe(false);
  });
  it('requires at least two tokens', () => {
    expect(isHeaderLine('NAME')).toBe(false);
  });
});

describe('highlightLine — semantic k8s status coloring', () => {
  it('dims a header row wholesale', () => {
    const spans = highlightLine('NAME   STATUS   AGE');
    expect(spans).toEqual([{ text: 'NAME   STATUS   AGE', kind: 'dim' }]);
  });

  it('greens healthy statuses', () => {
    expect(classified('web-abc   1/1   Running   0   5m')).toContainEqual(['Running', 'ok']);
  });

  it('reds failure statuses', () => {
    expect(classified('db-xyz   0/1   CrashLoopBackOff   7   9m')).toContainEqual(['CrashLoopBackOff', 'err']);
    expect(classified('n1   NotReady   control-plane   4h')).toContainEqual(['NotReady', 'err']);
  });

  it('ambers transitional statuses', () => {
    expect(classified('cache-1   0/1   Pending   0   2s')).toContainEqual(['Pending', 'warn']);
    expect(classified('p   0/1   ContainerCreating   0   1s')).toContainEqual(['ContainerCreating', 'warn']);
  });

  it('colors ready-ratios by whether all are up', () => {
    expect(classified('a   3/3   Running')).toContainEqual(['3/3', 'ok']);
    expect(classified('b   1/3   Running')).toContainEqual(['1/3', 'warn']);
  });

  it('handles Init: compound tokens', () => {
    expect(classified('p   0/1   Init:0/1   0   3s')).toContainEqual(['Init:0/1', 'warn']);
    expect(classified('p   0/1   Init:Error   0   3s')).toContainEqual(['Init:Error', 'err']);
  });

  it('does not color a status word buried inside another token', () => {
    // "running-migrations" is a pod name, not the STATUS column — must stay plain.
    expect(classified('running-migrations   1/1   Running')).not.toContainEqual(['running-migrations', 'ok']);
  });

  it('preserves the original text exactly (whitespace intact)', () => {
    const line = 'web-abc   1/1   Running   0   5m';
    expect(highlightLine(line).map((s) => s.text).join('')).toBe(line);
  });
});

describe('hasAnsi', () => {
  it('is true when SGR codes are present', () => {
    expect(hasAnsi('\x1b[32mReady\x1b[0m')).toBe(true);
  });
  it('is false for plain kubectl output', () => {
    expect(hasAnsi('NAME   STATUS\nweb   Running')).toBe(false);
  });
});

describe('parseAnsiRuns', () => {
  const pal = ANSI_PALETTES.dark;

  it('splits colored and uncolored runs and drops the escape codes', () => {
    const runs = parseAnsiRuns('plain \x1b[31mred\x1b[0m tail', pal);
    expect(runs.map((r) => r.text).join('')).toBe('plain red tail');
    expect(runs.find((r) => r.text === 'red')?.color).toBe(pal.normal[1]);
    expect(runs.find((r) => r.text === ' tail')?.color).toBeNull();
  });

  it('applies bold and bright foregrounds', () => {
    const runs = parseAnsiRuns('\x1b[1;32mbold-green\x1b[0m', pal);
    expect(runs[0]).toMatchObject({ text: 'bold-green', color: pal.bright[2], bold: true });
  });

  it('resets styling on \\x1b[0m', () => {
    const runs = parseAnsiRuns('\x1b[31mred\x1b[0mplain', pal);
    expect(runs.find((r) => r.text === 'plain')?.color).toBeNull();
  });

  it('parses 256-color and truecolor foregrounds', () => {
    const c256 = parseAnsiRuns('\x1b[38;5;196mx\x1b[0m', pal);
    expect(c256[0]?.color).toMatch(/^#/);
    const cRgb = parseAnsiRuns('\x1b[38;2;255;0;0mx\x1b[0m', pal);
    expect(cRgb[0]?.color).toBe('#ff0000');
  });

  it('never emits raw escape sequences as text', () => {
    const runs = parseAnsiRuns('\x1b[33mgrep\x1b[K match\x1b[0m', pal);
    expect(runs.map((r) => r.text).join('')).not.toContain('\x1b');
  });
});
