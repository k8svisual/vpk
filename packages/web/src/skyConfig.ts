import type { Theme } from './theme';

/** drei's `<Sky>` (a Preetham physical-sky shader) or `<Stars>` (a procedural instanced starfield) — both
 *  already shader-driven under the hood, no custom GLSL needed for either. One config per theme (DESIGN's
 *  4-theme system), tuned to read as an extension of that theme's own accent colors rather than a bolted-on
 *  generic skybox: Light gets a clear midday sky, Dark a starfield over its own near-black background, Forest
 *  a warm low-sun dusk, Ocean a hazy blue-heavy horizon. */
export type SkyBackdrop =
  | {
      kind: 'sky';
      sunPosition: [number, number, number];
      turbidity: number;
      rayleigh: number;
      mieCoefficient: number;
      mieDirectionalG: number;
    }
  | {
      kind: 'stars';
      background: string;
      radius: number;
      depth: number;
      count: number;
      factor: number;
      fade: boolean;
      speed: number;
    };

export const SKY_CONFIG: Record<Theme, SkyBackdrop> = {
  light: { kind: 'sky', sunPosition: [10, 25, 10], turbidity: 2, rayleigh: 3.5, mieCoefficient: 0.003, mieDirectionalG: 0.8 },
  dark: { kind: 'stars', background: '#05070c', radius: 120, depth: 60, count: 3500, factor: 4, fade: true, speed: 0.4 },
  forest: { kind: 'sky', sunPosition: [6, 4, -10], turbidity: 4, rayleigh: 4, mieCoefficient: 0.008, mieDirectionalG: 0.9 },
  ocean: { kind: 'sky', sunPosition: [3, 6, -18], turbidity: 5, rayleigh: 4.5, mieCoefficient: 0.01, mieDirectionalG: 0.92 },
};

/** Depth-fog color per theme (Settings' "Depth fog" toggle) — kept alongside SKY_CONFIG since it's the same
 *  "atmosphere per theme" idea: a color that reads as an extension of that theme's own sky/backdrop rather
 *  than a mismatched haze. Roughly each theme's own sky/background hue, so distant objects fade INTO the
 *  backdrop instead of into a random flat grey. */
export const FOG_COLOR: Record<Theme, string> = {
  light: '#bcd6f2',
  dark: '#05070c',
  forest: '#cfe0c6',
  ocean: '#a9d0e0',
};
