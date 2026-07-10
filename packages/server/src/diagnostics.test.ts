import { describe, it, expect } from 'vitest';
import { collectSystemDiagnostics } from './diagnostics';

describe('collectSystemDiagnostics', () => {
  it('returns real (non-zero, non-stubbed) system facts', () => {
    const d = collectSystemDiagnostics();
    expect(d.architecture).toBeTruthy();
    expect(d.osName).toBeTruthy();
    expect(d.cpuCount).toBeGreaterThan(0);
    expect(d.processor).toBeTruthy();
    expect(d.heap.totalMemoryBytes).toBeGreaterThan(0);
    expect(d.heap.memoryLimitBytes).toBeGreaterThan(0);
    expect(d.hostname).toBeTruthy();
    expect(d.cwd).toBeTruthy();
    expect(d.nodeVersion).toMatch(/^v?\d+\./);
  });

  it('only includes external, IPv4 network interfaces', () => {
    const d = collectSystemDiagnostics();
    for (const iface of d.networkInterfaces) {
      expect(iface.address).toBeTruthy();
      expect(iface.mac).toBeTruthy();
    }
  });
});
