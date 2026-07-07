import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { iconUrlForKind } from './kindIcons';

/**
 * Demo Data screen — placeholder for now (read-only list of the extracted templates). The actual point of
 * this feature — defining/generating synthetic Nodes/Pods/etc. at scale for testing the Field/Wheel/Schematic
 * views — is a follow-up; see @vpk/core's demoTemplates.ts for the templates themselves and how they were
 * extracted from a real snapshot capture.
 */
export function DemoDataView() {
  const [kinds, setKinds] = useState<string[] | null>(null);

  useEffect(() => {
    fetch('/demo/templates')
      .then((r) => r.json() as Promise<Record<string, unknown>>)
      .then((data) => setKinds(Object.keys(data).sort()))
      .catch(() => setKinds([]));
  }, []);

  return (
    <div className="flex flex-col gap-3 p-1 text-sm" style={{ color: 'var(--vpk-fg)' }}>
      <div className="flex items-center gap-2">
        <FlaskConical size={18} />
        <h2 className="text-base font-medium">Demo Data</h2>
      </div>
      <p style={{ color: 'var(--vpk-fg-muted)' }}>
        Templates below were extracted from a real cluster capture, one representative object per Kind, with
        instance-identity fields (uid, name, namespace, ...) replaced by <code>{'{{placeholder}}'}</code>{' '}
        tokens. This screen is read-only for now — defining new demo items and generating synthetic snapshot
        data from these templates is coming in a later pass.
      </p>
      {kinds === null && <p style={{ color: 'var(--vpk-fg-muted)' }}>Loading templates…</p>}
      {kinds !== null && kinds.length === 0 && <p style={{ color: 'var(--vpk-fg-muted)' }}>No templates available.</p>}
      {kinds !== null && kinds.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
          {kinds.map((kind) => (
            <div
              key={kind}
              className="flex items-center gap-2 rounded border px-2 py-1.5"
              style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-surface)' }}
            >
              <img src={iconUrlForKind(kind)} alt="" style={{ width: 16, height: 16 }} />
              <span>{kind}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
