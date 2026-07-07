import { describe, it, expect, vi } from 'vitest';
import { listenWithRetry } from './portRetry';

function busyError(): Error & { code: string } {
  return Object.assign(new Error('address in use'), { code: 'EADDRINUSE' });
}

describe('listenWithRetry', () => {
  it('resolves with the start port when it is free on the first try', async () => {
    const tryListen = vi.fn().mockResolvedValue(undefined);
    const port = await listenWithRetry(4200, tryListen);
    expect(port).toBe(4200);
    expect(tryListen).toHaveBeenCalledTimes(1);
    expect(tryListen).toHaveBeenCalledWith(4200);
  });

  it('tries the next port up each time the current one is busy', async () => {
    const tryListen = vi
      .fn()
      .mockRejectedValueOnce(busyError())
      .mockRejectedValueOnce(busyError())
      .mockResolvedValueOnce(undefined);
    const port = await listenWithRetry(4200, tryListen);
    expect(port).toBe(4202);
    expect(tryListen).toHaveBeenNthCalledWith(1, 4200);
    expect(tryListen).toHaveBeenNthCalledWith(2, 4201);
    expect(tryListen).toHaveBeenNthCalledWith(3, 4202);
  });

  it('calls onRetry with the busy port and the next one to try', async () => {
    const tryListen = vi.fn().mockRejectedValueOnce(busyError()).mockResolvedValueOnce(undefined);
    const onRetry = vi.fn();
    await listenWithRetry(4200, tryListen, { onRetry });
    expect(onRetry).toHaveBeenCalledWith(4200, 4201);
  });

  it('rethrows a non-EADDRINUSE error immediately, without retrying', async () => {
    const boom = new Error('permission denied');
    const tryListen = vi.fn().mockRejectedValue(boom);
    await expect(listenWithRetry(4200, tryListen)).rejects.toBe(boom);
    expect(tryListen).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts and reports the range it tried', async () => {
    const tryListen = vi.fn().mockRejectedValue(busyError());
    await expect(listenWithRetry(4200, tryListen, { maxAttempts: 3 })).rejects.toThrow('4200-4202');
    expect(tryListen).toHaveBeenCalledTimes(3);
  });
});
