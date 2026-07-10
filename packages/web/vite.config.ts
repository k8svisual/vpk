import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_API_PORT = 4200;

/** The API server writes its actual bound port to this file once listening (server.ts's `listenWithRetry`) —
 *  it may differ from the default if that port was already taken. Read once at Vite's own startup, so the
 *  proxy still finds the API even when it had to fall back to a different port. Falls back to the default if
 *  the file doesn't exist yet (start the API server first — this isn't re-read once Vite is running). */
function discoverApiPort(): number {
  try {
    const port = Number(readFileSync(process.env.VPK_PORT_FILE ?? join(here, '../../.vpk-port'), 'utf8').trim());
    if (Number.isInteger(port) && port > 0) return port;
  } catch {
    // no port file yet — the API server hasn't started, or was started before this discovery mechanism existed
  }
  return DEFAULT_API_PORT;
}

const API = `http://127.0.0.1:${discoverApiPort()}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/ownerref': API,
      '/definition': API,
      '/explain': API,
      '/health': API,
      '/snapshots': API,
      '/resources': API,
      '/namespaces': API,
      '/network': API,
      '/security': API,
      '/storage': API,
      '/storage-counts': API,
      '/events': API,
      '/schematic': API,
      '/schematic.svg': API,
      '/container-schematic.svg': API,
      '/rbac.svg': API,
      '/who-can': API,
      '/container-images': API,
      '/scene': API,
      '/demo': API,
      '/load': API,
      '/capture': API,
      '/settings': API,
      '/vendor-icons': API,
      '/network-catalog': API,
      '/stats': API,
      '/logs': API,
      '/diagnostics': API,
      '/client-error': API,
      '/shutdown': API,
    },
  },
});
