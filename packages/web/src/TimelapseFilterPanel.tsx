import type { ClusterWheel } from './Scene3D';
import { presentTimelapseCategories, presentTimelapsePlanes, type TimelapseCategoryFilters, type TimelapseCategoryRow } from './timelapse';

/**
 * Timelapse's own filter slide-out — independent state from the main Wheel FilterPanel, only relevant while
 * the timelapse is running. Every row here corresponds to something actually present in the current wheel
 * (per "only items in the wheel need to be in the filter slide out") — a category or resource plane with
 * nothing in it simply never gets a row, mirroring FilterPanel's own presentPanes convention.
 */
export function TimelapseFilterPanel({
  wheel,
  filters,
  onChange,
  onClose,
}: {
  wheel: ClusterWheel;
  filters: TimelapseCategoryFilters;
  onChange: (next: TimelapseCategoryFilters) => void;
  onClose: () => void;
}) {
  const categories = presentTimelapseCategories(wheel);
  const planes = presentTimelapsePlanes(wheel);

  function toggleCategory(key: TimelapseCategoryRow['key']) {
    onChange({ ...filters, [key]: !filters[key] });
  }

  function togglePlane(name: string) {
    onChange({ ...filters, planes: { ...filters.planes, [name]: !filters.planes[name] } });
  }

  return (
    <div
      className="absolute top-11 left-2 z-20 max-h-[calc(100%-3rem)] w-72 overflow-y-auto rounded border text-xs shadow-lg"
      style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
    >
      <div
        className="sticky top-0 flex items-center justify-between border-b px-2 py-1.5"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <span className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
          Filter timelapse
        </span>
        <button onClick={onClose} className="cursor-pointer rounded border px-1.5 py-0.5" style={{ borderColor: 'var(--vpk-border)' }}>
          Close
        </button>
      </div>

      {categories.map((c) => (
        <label key={c.key} className="flex cursor-pointer items-center gap-2 px-2 py-1">
          <input type="checkbox" checked={filters[c.key]} onChange={() => toggleCategory(c.key)} />
          <span style={{ color: 'var(--vpk-fg)' }}>{c.label}</span>
        </label>
      ))}

      {planes.length > 0 && (
        <>
          <div className="px-2 pt-3 pb-1 text-xs font-medium" style={{ color: 'var(--vpk-rail-active-bg)' }}>
            Resource categories
          </div>
          {planes.map((p) => (
            <label key={p.name} className="flex cursor-pointer items-center gap-2 px-2 py-1">
              <input type="checkbox" checked={filters.planes[p.name] ?? false} onChange={() => togglePlane(p.name)} />
              <span className="h-3 w-3 shrink-0 rounded-sm border" style={{ background: p.color, borderColor: 'var(--vpk-border)' }} />
              <span style={{ color: 'var(--vpk-fg)' }}>{p.name}</span>
            </label>
          ))}
        </>
      )}
    </div>
  );
}
