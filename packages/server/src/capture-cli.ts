import { writeFileSync } from 'node:fs';
import { captureCore } from './capture/cliSource';

// Usage: bun packages/server/src/capture-cli.ts [outfile]   (VPK_CLI="oc" to use a different CLI)
const outfile = process.argv[2] ?? 'snapshot.json';
const cli = (process.env.VPK_CLI ?? 'kubectl').split(' ').filter(Boolean);

const { items, manifest } = await captureCore({ cli });
writeFileSync(outfile, JSON.stringify({ ...manifest, items }));
console.log(`captured ${items.length} objects (${manifest.kinds} kinds, cluster ${manifest.cluster}) → ${outfile}`);
