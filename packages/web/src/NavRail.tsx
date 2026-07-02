import { useState } from 'react';
import { ChevronsLeft, ChevronsRight, type LucideIcon } from 'lucide-react';

export interface RailItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}
export interface RailGroup<T extends string> {
  title: string;
  items: RailItem<T>[];
}

/**
 * Left icon rail (DESIGN.md UI shell): views grouped (Explore / Lenses / Info), collapsible. Icon-only when
 * collapsed (default) with a title tooltip; labels appear alongside icons when expanded.
 */
export function NavRail<T extends string>({
  groups,
  active,
  onSelect,
}: {
  groups: RailGroup<T>[];
  active: T;
  onSelect: (id: T) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <nav
      className="flex flex-col shrink-0 border-r"
      style={{ background: 'var(--vpk-rail-bg)', borderColor: 'var(--vpk-border)', width: collapsed ? 52 : 176 }}
    >
      <div className="flex flex-col gap-4 py-3 flex-1 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <div className="px-3 pb-1 text-[10px] font-semibold tracking-wide uppercase" style={{ color: 'var(--vpk-fg-muted)' }}>
                {group.title}
              </div>
            )}
            <div className="flex flex-col gap-0.5 px-1.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => onSelect(item.id)}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors cursor-pointer"
                    style={{
                      color: isActive ? 'var(--vpk-rail-fg-active)' : 'var(--vpk-rail-fg)',
                      background: isActive ? 'var(--vpk-rail-active-bg)' : 'transparent',
                    }}
                  >
                    <Icon size={16} strokeWidth={isActive ? 2.25 : 1.75} />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand' : 'Collapse'}
        className="flex items-center justify-center py-2 cursor-pointer border-t"
        style={{ color: 'var(--vpk-rail-fg)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
      </button>
    </nav>
  );
}
