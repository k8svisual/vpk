import { VpkIcon } from './VpkIcon';

/** Branding + license info, opened from the nav rail's VpK logo button (DESIGN: every open-source build needs
 *  a reachable copyright/license notice — this is that, not tucked away in a file nobody opens). */
export function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded border shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        {/* Same banner treatment as the "Capture from Cluster" modal — var(--vpk-accent)/var(--vpk-rail-bg)
            both vary per theme (see index.css's [data-theme=...] blocks), so this gradient re-colors with
            the rest of the app instead of staying one fixed look across Light/Dark/Forest/Ocean. */}
        <div
          className="flex flex-col items-center gap-2 px-5 py-4 text-center"
          style={{ background: 'linear-gradient(135deg, var(--vpk-accent), var(--vpk-rail-bg))' }}
        >
          <VpkIcon size={56} className="rounded" />
          <div>
            <div className="font-medium" style={{ color: '#fff' }}>
              VpK
            </div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Visually presented Kubernetes
            </div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
              v{__VPK_VERSION__}
            </div>
          </div>
        </div>

        <div className="flex flex-col p-5 text-center">
          <div className="mb-4 text-xs" style={{ color: 'var(--vpk-fg)' }}>
            <p>Copyright 2018–2026 Dave Weilert</p>
            <p>
              Licensed under the{' '}
              <a
                href="https://www.apache.org/licenses/LICENSE-2.0"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--vpk-accent)' }}
              >
                Apache License, Version 2.0
              </a>
            </p>
          </div>

          <p className="mb-4 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
            Kubernetes resource icons are the property of their respective projects and organizations. Any errors or
            omissions in attribution are unintentional and imply no ownership claim.
          </p>

          <button
            onClick={onClose}
            className="mx-auto cursor-pointer rounded border px-3 py-1 text-xs"
            style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
