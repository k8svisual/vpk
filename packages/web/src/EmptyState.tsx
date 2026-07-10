import type { LucideIcon } from 'lucide-react';

/**
 * A "nothing selected yet / nothing here" placeholder — icon + message, with enough presence and breathing
 * room that it reads as a deliberate empty state rather than an unfinished page (the plain one-line
 * `<p style={{color: 'var(--vpk-fg-muted)'}}>` text every view used before this just sat in the corner of an
 * otherwise-blank canvas). Left top-aligned rather than vertically centered in its container — several call
 * sites (e.g. Resources) render this below active picker controls, where true centering in the remaining
 * space would visually detach the message from the controls that produced it.
 */
export function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 pt-16 pb-4 text-center">
      <Icon size={28} style={{ color: 'var(--vpk-fg-muted)', opacity: 0.6 }} />
      <p className="max-w-sm text-sm" style={{ color: 'var(--vpk-fg-muted)' }}>
        {children}
      </p>
    </div>
  );
}
