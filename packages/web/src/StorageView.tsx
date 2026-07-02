import { useEffect, useState } from 'react';

interface StoragePv {
  id: string;
  name: string;
  capacityBytes?: number;
  phase?: string;
  claimNamespace?: string;
  claimName?: string;
  pvcId?: string;
}
interface StorageGroup {
  name: string;
  scId?: string;
  provisioner?: string;
  totalCapacityBytes: number;
  pvs: StoragePv[];
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
function formatBytes(bytes: number | undefined): string {
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

const phaseColor: Record<string, string> = {
  Bound: '#2e8b57',
  Available: '#2a5db0',
  Released: '#d4a017',
  Failed: '#c0392b',
  Pending: '#d4a017',
};

function MagnitudeBar({ bytes, max }: { bytes: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((bytes / max) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 160 }}>
      <div style={{ flex: 1, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#4a7fc9' }} />
      </div>
      <span style={{ fontSize: 12, color: '#555', width: 56, textAlign: 'right' }}>{formatBytes(bytes)}</span>
    </div>
  );
}

export function StorageView({ onSelect }: { onSelect: (id: string) => void }) {
  const [groups, setGroups] = useState<StorageGroup[]>([]);

  useEffect(() => {
    fetch('/storage')
      .then((r) => r.json() as Promise<StorageGroup[]>)
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

  const maxBytes = Math.max(1, ...groups.map((g) => g.totalCapacityBytes));

  return (
    <div style={{ fontSize: 13 }}>
      {groups.length === 0 && <p style={{ color: '#888' }}>No StorageClasses or PersistentVolumes in this snapshot.</p>}
      {groups.map((g) => (
        <details key={g.name || '(none)'} open style={{ marginBottom: 10 }}>
          <summary style={{ cursor: 'pointer', padding: '4px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
            <strong
              style={g.scId ? { color: '#2a5db0', cursor: 'pointer' } : undefined}
              onClick={(e) => {
                if (!g.scId) return;
                e.preventDefault();
                onSelect(g.scId);
              }}
            >
              {g.name || '(no storage class)'}
            </strong>
            {g.provisioner && <span style={{ color: '#777' }}>{g.provisioner}</span>}
            <MagnitudeBar bytes={g.totalCapacityBytes} max={maxBytes} />
            {g.pvs.length === 0 && <span style={{ color: '#999' }}>None used</span>}
          </summary>
          {g.pvs.length > 0 && (
            <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 4 }}>
              <tbody>
                {g.pvs.map((pv) => (
                  <tr
                    key={pv.id}
                    onClick={() => onSelect(pv.id)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f8f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '3px 8px', width: 12 }}>
                      <span
                        title={pv.phase ?? 'Unknown'}
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: phaseColor[pv.phase ?? ''] ?? '#999',
                        }}
                      />
                    </td>
                    <td style={{ padding: '3px 8px' }}>{pv.name}</td>
                    <td style={{ padding: '3px 8px' }}>
                      <MagnitudeBar bytes={pv.capacityBytes ?? 0} max={maxBytes} />
                    </td>
                    <td style={{ padding: '3px 8px', color: '#555' }}>
                      {pv.claimName ? `claim ${pv.claimNamespace}/${pv.claimName}` : 'unclaimed'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
      ))}
    </div>
  );
}
