export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
}

const MAX_ENTRIES = 500;
const buffer: LogEntry[] = [];

/** In-memory ring buffer backing the "Logs" viewer (see LogsModal.tsx) — server restarts lose it, which is
 *  fine: it's a live "what's the app doing right now" window, not an audit trail. Also echoes to the process's
 *  own stdout/stderr (so it still shows up in a terminal running the server directly), so call sites can
 *  replace their old console.log/console.error with this instead of needing both. */
export function pushLog(level: LogLevel, message: string): void {
  buffer.push({ time: new Date().toISOString(), level, message });
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  const line = `[${level}] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function getLogs(): LogEntry[] {
  return buffer;
}

export function clearLogs(): void {
  buffer.length = 0;
}
