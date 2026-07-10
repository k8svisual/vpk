import { cpus, hostname, machine, networkInterfaces, release, type } from 'node:os';
import { getHeapStatistics } from 'node:v8';

/**
 * System/runtime facts for the diagnostic-bundle download (Logs modal) — the same fields the legacy app's
 * "About" system-info panel showed (Architecture/Machine/OS/CPU/Heap/Network/cwd/Node version), re-sourced
 * from `node:os`/`node:v8` directly rather than the legacy app's `process.report.writeReport()` dump: Bun's
 * `process.report` is only a partial compatibility stub (empty CPU list, zeroed heap stats, no network
 * interfaces as of this writing) where `os`/`v8` give the real numbers under Bun.
 */
export interface SystemDiagnostics {
  architecture: string;
  machine: string;
  osName: string;
  osRelease: string;
  processor?: string;
  cpuCount: number;
  userCpuSeconds: number;
  kernelCpuSeconds: number;
  heap: {
    totalMemoryBytes: number;
    committedMemoryBytes: number;
    usedMemoryBytes: number;
    availableMemoryBytes: number;
    memoryLimitBytes: number;
  };
  hostname: string;
  /** External (non-internal) IPv4 interfaces only — same filter the legacy panel used; loopback/internal
   *  interfaces are never useful for "which machine is this" troubleshooting. */
  networkInterfaces: { name: string; mac: string; address: string }[];
  cwd: string;
  nodeVersion: string;
  bunVersion?: string;
}

export function collectSystemDiagnostics(): SystemDiagnostics {
  const cpuUsage = process.cpuUsage();
  const heap = getHeapStatistics();
  const ifaces = Object.entries(networkInterfaces()).flatMap(([name, addrs]) =>
    (addrs ?? []).filter((a) => !a.internal && a.family === 'IPv4').map((a) => ({ name, mac: a.mac, address: a.address })),
  );

  return {
    architecture: process.arch,
    machine: typeof machine === 'function' ? machine() : process.arch,
    osName: type(),
    osRelease: release(),
    processor: cpus()[0]?.model,
    cpuCount: cpus().length,
    userCpuSeconds: cpuUsage.user / 1e6,
    kernelCpuSeconds: cpuUsage.system / 1e6,
    heap: {
      totalMemoryBytes: heap.total_heap_size,
      committedMemoryBytes: heap.total_physical_size,
      usedMemoryBytes: heap.used_heap_size,
      availableMemoryBytes: heap.total_available_size,
      memoryLimitBytes: heap.heap_size_limit,
    },
    hostname: hostname(),
    networkInterfaces: ifaces,
    cwd: process.cwd(),
    nodeVersion: process.version,
    // `process.versions.bun` is how Bun identifies itself when running Bun-compiled code (no bun-types
    // dependency needed to read it — process.versions is already a plain Record<string, string>).
    bunVersion: process.versions.bun,
  };
}
