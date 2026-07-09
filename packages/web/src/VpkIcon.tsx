import { useEffect, useRef } from 'react';

/** The VpK badge — a rounded-heptagon (all 7 vertices equidistant from its own centroid), a white border ring,
 *  and the "VpK" wordmark. Rendered as real inline SVG (not an <img src>) specifically so the wordmark can
 *  self-size: `text.getBBox()` measures whatever font the browser actually substituted for "Arial", then a
 *  transform scales+centers that measured box to fill TARGET_W x TARGET_H — hand-picking a static font-size
 *  broke twice (too wide for the badge, spilling past the border) before landing on this approach. */
const PATH_D = 'M1.09 11.755 2.8 4.263 9.723.93l6.924 3.334 1.71 7.492-4.792 6.007H5.881Z';
// The heptagon's own bounding-box center, in the coordinate space after the shared translate(-1.09,-.929).
const CENTER_X = 8.633;
const CENTER_Y = 8.4175;
// Deliberately near the badge's ~17.3-unit width but with margin so the wordmark stays inside the BLUE area,
// not spilling into the white border.
const TARGET_WIDTH = 13.6;
const TARGET_HEIGHT = 9.2;
const VIEWBOX_ASPECT = 18.033 / 18.467;

export function VpkIcon({ size = 22, className }: { size?: number; className?: string }) {
  const textRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    const text = textRef.current;
    if (!text) return;
    const bbox = text.getBBox();
    if (bbox.width === 0 || bbox.height === 0) return; // not yet laid out (e.g. hidden ancestor) — skip silently
    const scale = Math.min(TARGET_WIDTH / bbox.width, TARGET_HEIGHT / bbox.height);
    const bcx = bbox.x + bbox.width / 2;
    const bcy = bbox.y + bbox.height / 2;
    text.setAttribute('transform', `translate(${CENTER_X} ${CENTER_Y}) scale(${scale}) translate(${-bcx} ${-bcy})`);
  }, []);

  return (
    <svg
      width={size}
      height={size * VIEWBOX_ASPECT}
      viewBox="-0.6 -0.6 18.467 18.033"
      className={className}
      aria-label="VpK"
      role="img"
    >
      {/* White border ring — same shape scaled 1.06x about its OWN centroid (9.723, 9.785), not the SVG
          origin, so it grows evenly on every side (this heptagon's vertices are all equidistant from that
          point, so a centroid-anchored scale IS a uniform border for this shape). */}
      <path
        d={PATH_D}
        fill="#ffffff"
        fillRule="evenodd"
        transform="translate(-1.09 -.929) translate(9.723 9.785) scale(1.06) translate(-9.723 -9.785)"
      />
      <path d={PATH_D} fill="#326ce5" fillRule="evenodd" transform="translate(-1.09 -.929)" />
      <text ref={textRef} x={0} y={0} fontWeight={700} fontFamily="Arial, sans-serif" fill="#ffffff" fontSize={10}>
        VpK
      </text>
    </svg>
  );
}
