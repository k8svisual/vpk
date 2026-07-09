import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { projectEvents } from './events';
import type { RawObject } from '../types';

const pod: RawObject = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { uid: 'pod-1', name: 'app-0', namespace: 'default' },
};

const legacyEvent: RawObject = {
  apiVersion: 'v1',
  kind: 'Event',
  metadata: { uid: 'evt-1', name: 'app-0.a', namespace: 'default' },
  type: 'Normal',
  reason: 'Pulled',
  message: 'pulled image',
  count: 3,
  firstTimestamp: '2024-01-01T00:00:00Z',
  lastTimestamp: '2024-01-01T00:05:00Z',
  involvedObject: { kind: 'Pod', name: 'app-0', namespace: 'default', uid: 'pod-1' },
};

const seriesEvent: RawObject = {
  apiVersion: 'v1',
  kind: 'Event',
  metadata: { uid: 'evt-2', name: 'app-0.b', namespace: 'default' },
  type: 'Warning',
  reason: 'BackOff',
  eventTime: '2024-01-02T00:00:00Z',
  reportingComponent: 'kubelet',
  involvedObject: { kind: 'Pod', name: 'app-0', namespace: 'default', uid: 'pod-1' },
};

const danglingEvent: RawObject = {
  apiVersion: 'v1',
  kind: 'Event',
  metadata: { uid: 'evt-3', name: 'ghost.a', namespace: 'default' },
  type: 'Warning',
  reason: 'FailedScheduling',
  eventTime: '2024-01-03T00:00:00Z',
  involvedObject: { kind: 'Pod', name: 'ghost', namespace: 'default', uid: 'no-such-uid' },
};

describe('projectEvents', () => {
  const records = projectEvents(buildGraph([pod, legacyEvent, seriesEvent, danglingEvent]));

  it('emits one row per Event object', () => {
    expect(records).toHaveLength(3);
  });

  it('reads the legacy count/firstTimestamp/lastTimestamp reporting style', () => {
    const r = records.find((e) => e.id === 'evt-1')!;
    expect(r.count).toBe(3);
    expect(r.lastSeen).toBe('2024-01-01T00:05:00Z');
    expect(r.firstSeen).toBe('2024-01-01T00:00:00Z');
  });

  it('falls back to eventTime and defaults count to 1 for the events.k8s.io reporting style', () => {
    const r = records.find((e) => e.id === 'evt-2')!;
    expect(r.count).toBe(1);
    expect(r.lastSeen).toBe('2024-01-02T00:00:00Z');
    expect(r.reportingComponent).toBe('kubelet');
  });

  it('resolves involvedObject to a graph id when the target still exists', () => {
    const r = records.find((e) => e.id === 'evt-1')!;
    expect(r.involvedObjectId).toBe('pod-1');
  });

  it('leaves involvedObjectId undefined when the target uid is not in this snapshot', () => {
    const r = records.find((e) => e.id === 'evt-3')!;
    expect(r.involvedObjectId).toBeUndefined();
    expect(r.involvedObjectKind).toBe('Pod');
    expect(r.involvedObjectName).toBe('ghost');
  });

  it('sorts newest lastSeen first', () => {
    expect(records.map((e) => e.id)).toEqual(['evt-3', 'evt-2', 'evt-1']);
  });

  it('defaults type to Normal when missing/unrecognized', () => {
    const weird: RawObject = {
      apiVersion: 'v1',
      kind: 'Event',
      metadata: { uid: 'evt-4', name: 'weird', namespace: 'default' },
      involvedObject: { kind: 'Pod', name: 'app-0', namespace: 'default', uid: 'pod-1' },
    };
    const [r] = projectEvents(buildGraph([weird]));
    expect(r!.type).toBe('Normal');
  });
});
