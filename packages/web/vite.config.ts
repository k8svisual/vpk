import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API = 'http://127.0.0.1:4200';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/ownerref': API,
      '/definition': API,
      '/health': API,
      '/snapshots': API,
      '/resources': API,
      '/network': API,
      '/security': API,
      '/storage': API,
      '/schematic': API,
      '/container-images': API,
      '/load': API,
      '/capture': API,
    },
  },
});
