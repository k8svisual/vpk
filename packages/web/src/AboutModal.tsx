/** Branding + license info, opened from the nav rail's VpK logo button (DESIGN: every open-source build needs
 *  a reachable copyright/license notice — this is that, not tucked away in a file nobody opens). */
export function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-sm rounded border p-5 text-center shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <img src="/vpk.png" alt="VpK" width={64} height={64} className="mx-auto mb-3 rounded" />
        <h2 className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
          VpK
        </h2>
        <p className="mb-4 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
          Visually presented Kubernetes
        </p>

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
          className="cursor-pointer rounded border px-3 py-1 text-xs"
          style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
