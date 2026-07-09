import { useEffect, useMemo, useState } from 'react';
import { iconUrlForKind } from './kindIcons';
import { cssKindVar } from './kindColors';
import { Tooltip } from './Tooltip';
import { StorageCountsView, type CountsDimension } from './StorageCountsView';

interface StoragePod {
  id: string;
  name: string;
  namespace?: string;
}
interface StoragePv {
  id: string;
  name: string;
  capacityBytes?: number;
  phase?: string;
  claimNamespace?: string;
  claimName?: string;
  pvcId?: string;
  pods: StoragePod[];
  volumeAttachmentId?: string;
  volumeAttachmentName?: string;
  volumeAttachmentCsiDriverId?: string;
  volumeAttachmentCsiDriverName?: string;
}
interface StorageGroup {
  name: string;
  scId?: string;
  provisioner?: string;
  csiDriverId?: string;
  csiDriverName?: string;
  totalCapacityBytes: number;
  pvs: StoragePv[];
}
/** One CSIDriver -> its VolumeAttachments -> each one's PV, derived client-side from `groups` (every field it
 *  needs is already on StoragePv) for the CSIDriver->VA->PV->PVC->Pod hierarchy — a separate tree from
 *  StorageClass->PV->PVC->Pod since a PV reaches CSIDriver via VolumeAttachment, not via its StorageClass. */
interface DriverGroup {
  name: string;
  csiDriverId?: string;
  totalCapacityBytes: number;
  vas: { id?: string; name: string; pv: StoragePv }[];
}

/** Biggest StorageClass/CSIDriver first, and within it the biggest PV first — same ordering rule applied to
 *  both hierarchies (capacity is the thing this view is actually about, so size order reads more usefully
 *  than alphabetical). */
function byCapacityDesc(a: { capacityBytes?: number }, b: { capacityBytes?: number }): number {
  return (b.capacityBytes ?? 0) - (a.capacityBytes ?? 0);
}

function sortGroupsByCapacity(groups: StorageGroup[]): StorageGroup[] {
  return [...groups]
    .map((g) => ({ ...g, pvs: [...g.pvs].sort(byCapacityDesc) }))
    .sort((a, b) => b.totalCapacityBytes - a.totalCapacityBytes);
}

function buildDriverGroups(groups: StorageGroup[]): DriverGroup[] {
  const byDriver = new Map<string, DriverGroup>();
  for (const g of groups) {
    for (const pv of g.pvs) {
      if (!pv.volumeAttachmentName) continue;
      const key = pv.volumeAttachmentCsiDriverName ?? '(unresolved driver)';
      let driver = byDriver.get(key);
      if (!driver) {
        driver = { name: key, csiDriverId: pv.volumeAttachmentCsiDriverId, totalCapacityBytes: 0, vas: [] };
        byDriver.set(key, driver);
      }
      driver.vas.push({ id: pv.volumeAttachmentId, name: pv.volumeAttachmentName, pv });
      driver.totalCapacityBytes += pv.capacityBytes ?? 0;
    }
  }
  for (const driver of byDriver.values()) driver.vas.sort((a, b) => byCapacityDesc(a.pv, b.pv));
  return [...byDriver.values()].sort((a, b) => b.totalCapacityBytes - a.totalCapacityBytes);
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

/** A kind's icon on a circular badge colored to match that kind's color everywhere else in the app (3D wheel,
 *  OwnerRef graph, Schematic — see `kindColors.ts`). Hover shows the resource type (e.g. "Pod") followed by
 *  its name when one is given (e.g. "Pod\nmy-pod-abc123"); `detail` appends extra context (e.g. a PV's phase)
 *  after the name. Uses the shared custom `Tooltip` (same one NavRail uses) instead of the native `title`
 *  attribute — the native tooltip is unreliable/too small to read comfortably, per Tooltip.tsx's own docs. */
export function KindIcon({
  kind,
  name,
  size = 14,
  detail,
  bg,
}: {
  kind: string;
  name?: string;
  size?: number;
  detail?: string;
  bg?: string;
}) {
  const label = name ? `${kind}\n${name}${detail ? ` (${detail})` : ''}` : detail ? `${kind} (${detail})` : kind;
  return (
    <Tooltip label={label}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size + 7,
          height: size + 7,
          borderRadius: '50%',
          background: bg ?? cssKindVar(kind),
          flexShrink: 0,
        }}
      >
        <img src={iconUrlForKind(kind)} alt={kind} style={{ width: size, height: size }} />
      </span>
    </Tooltip>
  );
}

/** A small icon+label chip for a leaf/reference-style tree node — clickable when it resolved to a real
 *  resource id, plain text when it didn't (e.g. an unclaimed PV). */
function Chip({
  kind,
  label,
  id,
  onSelect,
  tone,
}: {
  kind: string;
  label: string;
  id?: string;
  onSelect: (id: string) => void;
  tone?: 'muted';
}) {
  const clickable = Boolean(id);
  return (
    <span
      onClick={clickable ? () => onSelect(id!) : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '1px 8px 1px 1px',
        borderRadius: 12,
        background: tone === 'muted' ? '#f2f2ef' : '#eef3fb',
        color: tone === 'muted' ? '#888' : '#2a5db0',
        cursor: clickable ? 'pointer' : 'default',
        fontSize: 12,
        whiteSpace: 'nowrap',
      }}
    >
      <KindIcon kind={kind} size={12} />
      {label}
    </span>
  );
}

/** Toggle triangle for a collapsible tree row — reserves its width even when hidden so sibling rows without
 *  children still line up in the same column. */
function CaretButton({ open, onToggle, visible }: { open: boolean; onToggle: () => void; visible: boolean }) {
  return (
    <button
      onClick={visible ? onToggle : undefined}
      style={{
        width: 14,
        flexShrink: 0,
        fontSize: 10,
        lineHeight: 1,
        color: 'var(--vpk-fg-muted, #888)',
        visibility: visible ? 'visible' : 'hidden',
        cursor: visible ? 'pointer' : 'default',
        background: 'none',
        border: 'none',
        padding: 0,
      }}
    >
      {open ? '▾' : '▸'}
    </button>
  );
}

/** The short horizontal stub connecting a tree row to its parent's vertical guide line (drawn by `Indent`). */
function Connector() {
  return (
    <span
      style={{ position: 'absolute', left: -12, top: '50%', height: 1, width: 12, background: 'var(--vpk-border, #ddd)' }}
    />
  );
}

/** A child-level wrapper: indents its contents and draws the continuous vertical guide line each child's
 *  `Connector` stub attaches to — the standard file-tree look. */
function Indent({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginLeft: 6, paddingLeft: 12, borderLeft: '1px solid var(--vpk-border, #ddd)' }}>{children}</div>
  );
}

/** Pod row — a leaf, no children, no caret. */
function PodRow({ pod, onSelect }: { pod: StoragePod; onSelect: (id: string) => void }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
      <Connector />
      <span style={{ display: 'inline-block', width: 14, flexShrink: 0 }} />
      <Chip kind="Pod" label={pod.name} id={pod.id} onSelect={onSelect} />
    </div>
  );
}

/** PVC row -> its Pods. Shared tail of both hierarchies (SC and CSIDriver trees both end PV -> PVC -> Pod). */
function PvcRow({ pv, onSelect }: { pv: StoragePv; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const hasPods = pv.pods.length > 0;
  return (
    <div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
        <Connector />
        <CaretButton open={open} onToggle={() => setOpen((o) => !o)} visible={hasPods} />
        {pv.claimName ? (
          <Chip kind="PersistentVolumeClaim" label={`${pv.claimNamespace}/${pv.claimName}`} id={pv.pvcId} onSelect={onSelect} />
        ) : (
          <Chip kind="PersistentVolumeClaim" label="unclaimed" onSelect={onSelect} tone="muted" />
        )}
      </div>
      {hasPods && open && (
        <Indent>
          {pv.pods.map((pod) => (
            <PodRow key={pod.id} pod={pod} onSelect={onSelect} />
          ))}
        </Indent>
      )}
    </div>
  );
}

/** PV row -> its PVC — reused as a child of both StorageClass (SC tree) and VolumeAttachment (CSIDriver
 *  tree), so it always renders its own connector/caret (it's never a tree root). */
function PvRow({ pv, maxBytes, onSelect }: { pv: StoragePv; maxBytes: number; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', flexWrap: 'wrap' }}>
        <Connector />
        <CaretButton open={open} onToggle={() => setOpen((o) => !o)} visible />
        <KindIcon kind="PersistentVolume" size={14} detail={pv.phase} />
        <span style={{ cursor: 'pointer', color: '#2a5db0' }} onClick={() => onSelect(pv.id)}>
          {pv.name}
        </span>
        <MagnitudeBar bytes={pv.capacityBytes ?? 0} max={maxBytes} />
      </div>
      {open && (
        <Indent>
          <PvcRow pv={pv} onSelect={onSelect} />
        </Indent>
      )}
    </div>
  );
}

/** Tree root: StorageClass -> PV -> PVC -> Pod. */
function StorageClassRow({ group, maxBytes, onSelect }: { group: StorageGroup; maxBytes: number; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const hasChildren = group.pvs.length > 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <CaretButton open={open} onToggle={() => setOpen((o) => !o)} visible={hasChildren} />
        <KindIcon kind="StorageClass" size={16} />
        <strong
          style={group.scId ? { color: '#2a5db0', cursor: 'pointer' } : undefined}
          onClick={() => group.scId && onSelect(group.scId)}
        >
          {group.name || '(no storage class)'}
        </strong>
        {group.provisioner && <span style={{ color: '#777' }}>{group.provisioner}</span>}
        <MagnitudeBar bytes={group.totalCapacityBytes} max={maxBytes} />
        {!hasChildren && <span style={{ color: '#999' }}>None used</span>}
      </div>
      {hasChildren && open && (
        <Indent>
          {group.pvs.map((pv) => (
            <PvRow key={pv.id} pv={pv} maxBytes={maxBytes} onSelect={onSelect} />
          ))}
        </Indent>
      )}
    </div>
  );
}

/** VolumeAttachment row -> its PV. */
function VolumeAttachmentRow({
  va,
  maxBytes,
  onSelect,
}: {
  va: { id?: string; name: string; pv: StoragePv };
  maxBytes: number;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
        <Connector />
        <CaretButton open={open} onToggle={() => setOpen((o) => !o)} visible />
        <Chip kind="VolumeAttachment" label={va.name} id={va.id} onSelect={onSelect} />
      </div>
      {open && (
        <Indent>
          <PvRow pv={va.pv} maxBytes={maxBytes} onSelect={onSelect} />
        </Indent>
      )}
    </div>
  );
}

/** Tree root: CSIDriver -> VolumeAttachment -> PV -> PVC -> Pod. */
function CsiDriverRow({ driver, maxBytes, onSelect }: { driver: DriverGroup; maxBytes: number; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const hasChildren = driver.vas.length > 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CaretButton open={open} onToggle={() => setOpen((o) => !o)} visible={hasChildren} />
        <KindIcon kind="CSIDriver" size={16} />
        <strong
          style={driver.csiDriverId ? { color: '#2a5db0', cursor: 'pointer' } : undefined}
          onClick={() => driver.csiDriverId && onSelect(driver.csiDriverId)}
        >
          {driver.name}
        </strong>
      </div>
      {hasChildren && open && (
        <Indent>
          {driver.vas.map((va) => (
            <VolumeAttachmentRow key={va.id ?? va.name} va={va} maxBytes={maxBytes} onSelect={onSelect} />
          ))}
        </Indent>
      )}
    </div>
  );
}

/** A top-level hierarchy section (the whole StorageClass tree, or the whole CSIDriver tree) — its own
 *  collapse toggle independent of every row's own toggle within it, so the entire set can be hidden at once. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: '0 0 8px' }}
      >
        <span style={{ width: 14, flexShrink: 0, fontSize: 10, color: 'var(--vpk-fg-muted, #888)' }}>{open ? '▾' : '▸'}</span>
        <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--vpk-fg-muted, #888)', margin: 0 }}>
          {title}
        </h3>
      </div>
      {open && children}
    </section>
  );
}

type ViewMode = 'hierarchy' | CountsDimension;

const VIEW_BUTTONS: { mode: ViewMode; label: string }[] = [
  { mode: 'hierarchy', label: 'SC / PV / PVC' },
  { mode: 'type', label: 'Counts by Volume Type' },
  { mode: 'node', label: 'Counts by Cluster Node' },
  { mode: 'namespace', label: 'Counts by Namespace' },
];

export function StorageView({ onSelect }: { onSelect: (id: string) => void }) {
  const [mode, setMode] = useState<ViewMode>('hierarchy');
  const [groups, setGroups] = useState<StorageGroup[]>([]);

  useEffect(() => {
    fetch('/storage')
      .then((r) => r.json() as Promise<StorageGroup[]>)
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

  const maxBytes = Math.max(1, ...groups.map((g) => g.totalCapacityBytes));
  const sortedGroups = useMemo(() => sortGroupsByCapacity(groups), [groups]);
  const driverGroups = useMemo(() => buildDriverGroups(groups), [groups]);

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {VIEW_BUTTONS.map((b) => (
          <button
            key={b.mode}
            onClick={() => setMode(b.mode)}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--vpk-border, #ccc)',
              background: mode === b.mode ? '#2a5db0' : 'var(--vpk-surface, #fff)',
              color: mode === b.mode ? '#fff' : 'var(--vpk-fg, #222)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      {mode === 'hierarchy' ? (
        groups.length === 0 ? (
          <p style={{ color: '#888' }}>No StorageClasses or PersistentVolumes in this snapshot.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Section title="StorageClass → PV → PVC → Pod">
              {sortedGroups.map((g) => (
                <StorageClassRow key={g.name || '(none)'} group={g} maxBytes={maxBytes} onSelect={onSelect} />
              ))}
            </Section>
            {driverGroups.length > 0 && (
              <Section title="CSIDriver → VolumeAttachment → PV → PVC → Pod">
                {driverGroups.map((d) => (
                  <CsiDriverRow key={d.name} driver={d} maxBytes={maxBytes} onSelect={onSelect} />
                ))}
              </Section>
            )}
          </div>
        )
      ) : (
        <StorageCountsView key={mode} root={mode} onSelect={onSelect} />
      )}
    </div>
  );
}
