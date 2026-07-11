import { describe, expect, it } from 'vitest';
import { evaluateCommandResult } from './commandResult';

describe('evaluateCommandResult', () => {
  it('resolves a path into JSON stdout and compares with ==', () => {
    const stdout = JSON.stringify({ status: { readyReplicas: 1 } });
    const result = evaluateCommandResult(stdout, { path: '.status.readyReplicas', op: '==', value: 1 });
    expect(result.passed).toBe(true);
    expect(result.values).toEqual([1]);
  });

  it('fails when the path resolves to a different value', () => {
    const stdout = JSON.stringify({ status: { readyReplicas: 0 } });
    const result = evaluateCommandResult(stdout, { path: '.status.readyReplicas', op: '==', value: 1 });
    expect(result.passed).toBe(false);
  });

  it('fails cleanly (no throw) when the path is missing from the JSON', () => {
    const stdout = JSON.stringify({ status: {} });
    const result = evaluateCommandResult(stdout, { path: '.status.readyReplicas', op: '==', value: 1 });
    expect(result.passed).toBe(false);
    expect(result.values).toEqual([]);
  });

  it('supports >= / <= numeric comparisons', () => {
    const stdout = JSON.stringify({ count: 3 });
    expect(evaluateCommandResult(stdout, { path: '.count', op: '>=', value: 2 }).passed).toBe(true);
    expect(evaluateCommandResult(stdout, { path: '.count', op: '<=', value: 2 }).passed).toBe(false);
  });

  it('falls back to the raw trimmed string when stdout is not JSON, for contains/matches', () => {
    const stdout = '  Hello World\n';
    expect(evaluateCommandResult(stdout, { op: 'contains', value: 'World' }).passed).toBe(true);
    expect(evaluateCommandResult(stdout, { op: 'matches', value: '^Hello' }).passed).toBe(true);
    expect(evaluateCommandResult(stdout, { op: 'contains', value: 'Goodbye' }).passed).toBe(false);
  });

  it('a path over non-JSON stdout resolves to no values (fails, does not throw)', () => {
    const result = evaluateCommandResult('not json at all', { path: '.status.readyReplicas', op: '==', value: 1 });
    expect(result.passed).toBe(false);
  });

  it('with no path, compares the whole parsed value directly', () => {
    const stdout = JSON.stringify('active');
    expect(evaluateCommandResult(stdout, { op: '==', value: 'active' }).passed).toBe(true);
  });
});
