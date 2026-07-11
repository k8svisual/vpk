import { useEffect, useState } from 'react';
import { VpkIcon } from './VpkIcon';

/**
 * Once-per-session branded launch screen (splashState.ts gates whether this even mounts) — same gradient
 * banner treatment as AboutModal (var(--vpk-accent) -> var(--vpk-rail-bg), re-colors with the active theme),
 * with the VpK badge zooming/spinning in via CSS (see index.css's vpk-splash-icon keyframes) to settle at
 * 25% of the viewport height. The "VpK" + "Visually presented Kubernetes" text lives in the banner ONCE,
 * same as AboutModal — no separate caption repeating it below the icon.
 *
 * ICON_ANIMATION_MS below must stay in sync with index.css's vpk-splash-icon animation-duration — there's no
 * single source shared between CSS and JS for it, so if one changes, change the other too.
 */

const ICON_ANIMATION_MS = 1100;
const HOLD_MS = 500;
const FADE_MS = 400;

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), ICON_ANIMATION_MS + HOLD_MS);
    const doneTimer = setTimeout(onDone, ICON_ANIMATION_MS + HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
    // Mount-once — onDone is a fresh closure from the parent every render, but restarting these timers on
    // every re-render would keep pushing the splash's dismissal out instead of ever finishing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4"
      style={{
        background: 'linear-gradient(135deg, var(--vpk-accent), var(--vpk-rail-bg))',
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: fading ? 'none' : 'auto',
      }}
      aria-hidden="true"
    >
      <div className="vpk-splash-icon" style={{ height: '25vh' }}>
        <VpkIcon size={1000} className="vpk-splash-icon__svg" />
      </div>
      <div className="text-center">
        <div className="text-2xl font-semibold" style={{ color: '#fff' }}>
          VpK
        </div>
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
          Visually presented Kubernetes
        </div>
      </div>
    </div>
  );
}
