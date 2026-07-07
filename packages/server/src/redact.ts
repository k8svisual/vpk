import type { RawObject } from '@vpk/core';

/** Shown in place of a Secret's real value, both when the Redact-Secrets display setting is on (view-time,
 *  toggleable — the real value is still saved underneath) and when Disable-pulling-Secrets discarded the real
 *  value at capture time (permanent — this message IS what got saved, so toggling Redact later changes
 *  nothing). Same message either way: the user shouldn't have to guess which case they're looking at. */
export const SECRET_DATA_UNAVAILABLE = 'Secret data is not available to view.';

/** Replaces every value in a Secret's `.data` and `.stringData` with the "not available" message, keeping the
 *  keys. Used two ways by callers: applied once at capture time (via `captureCore`'s `keepSecretData: false`)
 *  it's a permanent deletion baked into the saved snapshot; applied per-request in `/definition` (when the
 *  Redact-Secrets setting is on) it's a reversible display filter over whatever the snapshot actually has
 *  saved. No-op for every other kind. */
export function redactSecret(obj: RawObject): RawObject {
  if (obj.kind !== 'Secret') return obj;
  let out = obj;
  if (out.data && typeof out.data === 'object') {
    const redacted: Record<string, string> = {};
    for (const key of Object.keys(out.data as Record<string, unknown>)) redacted[key] = SECRET_DATA_UNAVAILABLE;
    out = { ...out, data: redacted };
  }
  if (out.stringData && typeof out.stringData === 'object') {
    const redacted: Record<string, string> = {};
    for (const key of Object.keys(out.stringData as Record<string, unknown>)) redacted[key] = SECRET_DATA_UNAVAILABLE;
    out = { ...out, stringData: redacted };
  }
  return out;
}

/** ConfigMap equivalent of SECRET_DATA_UNAVAILABLE — only ever a capture-time, permanent redaction (there's no
 *  view-time "Redact ConfigMaps" display setting, unlike Secrets), offered as a "Capture from cluster" option
 *  since a ConfigMap can carry sensitive text (embedded certs, connection strings) despite not being a Secret. */
export const CONFIGMAP_DATA_UNAVAILABLE = 'ConfigMap data is not available to view.';

/** Replaces every value in a ConfigMap's `.data` and `.binaryData` with the "not available" message, keeping
 *  the keys. No-op for every other kind. Mirrors redactSecret exactly, one kind over. */
export function redactConfigMap(obj: RawObject): RawObject {
  if (obj.kind !== 'ConfigMap') return obj;
  let out = obj;
  if (out.data && typeof out.data === 'object') {
    const redacted: Record<string, string> = {};
    for (const key of Object.keys(out.data as Record<string, unknown>)) redacted[key] = CONFIGMAP_DATA_UNAVAILABLE;
    out = { ...out, data: redacted };
  }
  if (out.binaryData && typeof out.binaryData === 'object') {
    const redacted: Record<string, string> = {};
    for (const key of Object.keys(out.binaryData as Record<string, unknown>)) redacted[key] = CONFIGMAP_DATA_UNAVAILABLE;
    out = { ...out, binaryData: redacted };
  }
  return out;
}
