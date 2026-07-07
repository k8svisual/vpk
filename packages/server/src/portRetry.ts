/**
 * Calls `tryListen(port)` starting at `startPort`, retrying at the next port up whenever it rejects with an
 * EADDRINUSE error, up to `maxAttempts` tries. Framework-agnostic (just a callback, not tied to Fastify/Node's
 * http server) so it's testable with a fake `tryListen` instead of binding real sockets.
 */
export async function listenWithRetry(
  startPort: number,
  tryListen: (port: number) => Promise<void>,
  opts: { maxAttempts?: number; onRetry?: (busyPort: number, nextPort: number) => void } = {},
): Promise<number> {
  const maxAttempts = opts.maxAttempts ?? 20;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = startPort + attempt;
    try {
      await tryListen(candidate);
      return candidate;
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== 'EADDRINUSE') throw err;
      opts.onRetry?.(candidate, candidate + 1);
    }
  }
  throw new Error(`no free port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}
