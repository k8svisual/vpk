/**
 * Parse a Kubernetes resource quantity (capacity/requests/limits, e.g. "10Gi", "500Mi", "2Ti", "1000") into
 * bytes. Supports binary suffixes (Ki/Mi/Gi/Ti/Pi/Ei, base 1024) and decimal suffixes (k/M/G/T/P/E, base
 * 1000). Used by the Storage view's magnitude bars (DESIGN §6.10). Returns undefined for empty/unparseable input.
 */
const BINARY: Record<string, number> = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, Pi: 1024 ** 5, Ei: 1024 ** 6 };
const DECIMAL: Record<string, number> = { k: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18 };

export function parseQuantity(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const match = /^([+-]?[0-9.]+)([A-Za-z]*)$/.exec(trimmed);
  if (!match) return undefined;
  const [, numStr, suffix] = match;
  const num = Number(numStr);
  if (Number.isNaN(num)) return undefined;
  if (!suffix) return num;
  if (suffix in BINARY) return num * (BINARY[suffix] as number);
  if (suffix in DECIMAL) return num * (DECIMAL[suffix] as number);
  return undefined;
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

/** Human-readable byte magnitude for the size-bar label (DESIGN §6.10 magnitude bar). */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || Number.isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  let n = bytes;
  let unit = 0;
  while (n >= 1024 && unit < UNITS.length - 1) {
    n /= 1024;
    unit++;
  }
  return `${n >= 100 ? Math.round(n) : Math.round(n * 10) / 10} ${UNITS[unit]}`;
}
