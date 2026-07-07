import { useState } from 'react';
import { ChevronsLeft, ChevronsRight, type LucideIcon } from 'lucide-react';
import { Tooltip } from './Tooltip';

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
  onAbout,
  footerItem,
}: {
  groups: RailGroup<T>[];
  active: T;
  onSelect: (id: T) => void;
  /** The VpK logo button at the top of the rail opens the About dialog — branding + Apache-2.0 copyright. */
  onAbout: () => void;
  /** Pinned above the collapse/expand chevron, separated from the scrollable group list above it — for an
   *  item that belongs to the rail itself rather than any view group (e.g. Demo Data). */
  footerItem?: RailItem<T>;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <nav
      className="flex flex-col shrink-0 border-r"
      style={{ background: 'var(--vpk-rail-bg)', borderColor: 'var(--vpk-border)', width: collapsed ? 52 : 176 }}
    >
      <Tooltip label="About VpK">
        <button
          type="button"
          aria-label="About VpK"
          onClick={onAbout}
          className="flex w-full items-center gap-2 px-2.5 py-2.5 cursor-pointer border-b"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <img src="/vpk.png" alt="" width={22} height={22} className="rounded shrink-0" />
          {!collapsed && (
            <span className="text-xs font-semibold tracking-tight" style={{ color: 'var(--vpk-rail-fg-active)' }}>
              VpK
            </span>
          )}
        </button>
      </Tooltip>
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
                  <Tooltip key={item.id} label={item.label}>
                    <button
                      type="button"
                      aria-label={item.label}
                      onClick={() => onSelect(item.id)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors cursor-pointer"
                      style={{
                        color: isActive ? 'var(--vpk-rail-fg-active)' : 'var(--vpk-rail-fg)',
                        background: isActive ? 'var(--vpk-rail-active-bg)' : 'transparent',
                      }}
                    >
                      <Icon size={16} strokeWidth={isActive ? 2.25 : 1.75} />
                      {!collapsed && <span>{item.label}</span>}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {footerItem && (
        <div className="flex flex-col gap-0.5 px-1.5 py-1.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <Tooltip label={footerItem.label}>
            <button
              type="button"
              aria-label={footerItem.label}
              onClick={() => onSelect(footerItem.id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors cursor-pointer"
              style={{
                color: footerItem.id === active ? 'var(--vpk-rail-fg-active)' : 'var(--vpk-rail-fg)',
                background: footerItem.id === active ? 'var(--vpk-rail-active-bg)' : 'transparent',
              }}
            >
              <footerItem.icon size={16} strokeWidth={footerItem.id === active ? 2.25 : 1.75} />
              {!collapsed && <span>{footerItem.label}</span>}
            </button>
          </Tooltip>
        </div>
      )}
      <Tooltip label={collapsed ? 'Expand' : 'Collapse'}>
        <button
          type="button"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center py-2 cursor-pointer border-t"
          style={{ color: 'var(--vpk-rail-fg)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
        </button>
      </Tooltip>
    </nav>
  );
}
