import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';

export type EventType = 'Normal' | 'Warning';

export interface EventRecord {
  id: ResourceId;
  type: EventType;
  reason?: string;
  message?: string;
  count: number;
  /** Best-available "when did this last happen" timestamp. Real snapshots mix two reporting styles — legacy
   *  firstTimestamp/lastTimestamp/count, and the events.k8s.io-style single eventTime — often on the SAME
   *  cluster, so never assume only one is set. Falls back lastTimestamp -> eventTime -> firstTimestamp. */
  lastSeen?: string;
  firstSeen?: string;
  reportingComponent?: string;
  involvedObjectKind?: string;
  involvedObjectName?: string;
  involvedObjectNamespace?: string;
  /** Resolved graph id for the involvedObject, when it still exists in this snapshot. Undefined for events
   *  whose target was already deleted by capture time (~15% on a real 12k-event OpenShift snapshot) — Events
   *  outlive the objects they describe by design, so this is expected, not an error case. */
  involvedObjectId?: ResourceId;
  namespace?: string;
}

interface InvolvedObjectRaw {
  kind?: string;
  name?: string;
  namespace?: string;
  uid?: string;
}

interface EventRaw {
  type?: string;
  reason?: string;
  message?: string;
  count?: number;
  firstTimestamp?: string | null;
  lastTimestamp?: string | null;
  eventTime?: string | null;
  reportingComponent?: string;
  source?: { component?: string };
  involvedObject?: InvolvedObjectRaw;
}

/** Cluster-wide Events projection (Events view). One row per Event object, newest-first by lastSeen —
 *  grouping/aggregation and Warning-only filtering are view concerns over this flat list, same pattern as
 *  projectPortUsage. */
export function projectEvents(graph: ResourceGraph): EventRecord[] {
  const records: EventRecord[] = [];
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'Event') continue;
    const raw = r.raw as EventRaw;
    const involved = raw.involvedObject;
    const involvedId = involved?.uid ? graph.byUid.get(involved.uid) : undefined;
    records.push({
      id: r.id,
      type: raw.type === 'Warning' ? 'Warning' : 'Normal',
      reason: raw.reason,
      message: raw.message,
      count: raw.count ?? 1,
      lastSeen: raw.lastTimestamp ?? raw.eventTime ?? raw.firstTimestamp ?? undefined,
      firstSeen: raw.firstTimestamp ?? raw.eventTime ?? undefined,
      reportingComponent: raw.reportingComponent || raw.source?.component,
      involvedObjectKind: involved?.kind,
      involvedObjectName: involved?.name,
      involvedObjectNamespace: involved?.namespace,
      involvedObjectId: involvedId,
      namespace: r.namespace,
    });
  }
  return records.sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));
}
