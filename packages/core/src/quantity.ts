/**
 * Parse a Kubernetes resource quantity (capacity/requests/limits, e.g. "10Gi", "500Mi", "2Ti", "1000") into
 * bytes. Supports binary suffixes (Ki/Mi/Gi/Ti/Pi/Ei, base 1024), decimal suffixes (m/k/M/G/T/P/E, base 1000
 * — "m"/milli applies to any quantity, not just CPU; see parseCpuQuantity's own comment for why CPU still
 * gets a dedicated parser), and the DecimalExponent form (`1e3`, `128974848e3`, `1.5E-2` — no suffix letter,
 * the API's own canonical output for some computed values, preserved verbatim by kubectl/oc). Used by the
 * Storage view's magnitude bars (DESIGN §6.10). Returns undefined for empty/unparseable input.
 */
const BINARY: Record<string, number> = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, Pi: 1024 ** 5, Ei: 1024 ** 6 };
const DECIMAL: Record<string, number> = { m: 1e-3, k: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18 };
/** K8s's own DecimalExponent grammar (apimachinery's quantity.go): optional sign, a decimal number (with or
 *  without a leading/trailing digit around the point), then `e`/`E`, then an optionally-signed integer
 *  exponent — no unit suffix letter, unlike DecimalSI/BinarySI. */
const DECIMAL_EXPONENT_RE = /^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)[eE][+-]?[0-9]+$/;

export function parseQuantity(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (DECIMAL_EXPONENT_RE.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isNaN(num) ? undefined : num;
  }
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

/** Parse a CPU quantity (cores, e.g. "2", "1500m") into a core count. `parseQuantity` also understands the
 *  generic "m" (milli, 1/1000) decimal suffix now, but this keeps its own dedicated regex + division rather
 *  than delegating, so millicore values stay exact division (`/1000`) instead of a floating-point multiply
 *  (`* 1e-3`) that can differ in the last bit for some inputs. */
export function parseCpuQuantity(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  const match = /^([+-]?[0-9.]+)m$/.exec(value.trim());
  if (match) {
    const num = Number(match[1]);
    return Number.isNaN(num) ? undefined : num / 1000;
  }
  return parseQuantity(value);
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
