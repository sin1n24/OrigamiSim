// Numeric (no THREE.js) reimplementation of OrigamiModel.fold()'s math, for
// fast iteration on new fold sequences before porting them into main.ts.
// IMPORTANT: layer-index semantics must match the real engine exactly --
// `fold()` mutates "kept" layers IN PLACE (same index) and appends all new
// flaps to the END only after the whole target set is processed (never
// interleaved kept/moved per layer). An earlier version of this file used an
// interleaved order and it silently verified the wrong layer indices for
// steps with explicit targetLayers -- see CLAUDE.md.
import { clipHalfPlane, signedSide, type Pt } from '../src/origami/geometry.ts';
import { type Affine, IDENTITY, MIRROR_Y, apply, compose, invert, rotation, translation } from '../src/origami/affine.ts';

export interface L {
  poly: Pt[];
  localToRoot: Affine;
}

const EPS_AREA = 1e-9;

export function area(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
}

function makeFlap(layer: L, poly: Pt[], a: Pt, b: Pt, isFlatHalfTurn: boolean): L {
  const theta = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const hingeXform = compose(translation(a[0], a[1]), rotation(theta));
  const rootToHinge = invert(hingeXform);
  const flapLocal = poly.map((p) => apply(rootToHinge, p));
  const flapLocalToRoot = compose(compose(layer.localToRoot, hingeXform), isFlatHalfTurn ? MIRROR_Y : IDENTITY);
  return { poly: flapLocal, localToRoot: flapLocalToRoot };
}

/**
 * Mimics OrigamiModel.fold() exactly: kept layers stay AT THE SAME INDEX
 * (mutated in place); newly-created flaps are appended to the end only after
 * the whole targeted set has been processed. `angleDeg` matters only for
 * whether this is a +-180 flat half-turn (mirrors the flap's frame) -- see
 * foldEngine.ts's isFlatHalfTurn comment for why abs(abs(angleDeg)-180) and
 * not abs(angleDeg-180).
 */
export function fold(layers: L[], line: [Pt, Pt], targets: number[] | 'all', movingSidePointRoot: Pt, angleDeg = 180): L[] {
  const isFlatHalfTurn = Math.abs(Math.abs(angleDeg) - 180) < 1e-6;
  const indices = targets === 'all' ? layers.map((_, i) => i) : targets;
  const newLayers: L[] = [];
  for (const i of indices) {
    const layer = layers[i];
    const rootToLocal = invert(layer.localToRoot);
    const a = apply(rootToLocal, line[0]);
    const b = apply(rootToLocal, line[1]);
    const ref = apply(rootToLocal, movingSidePointRoot);
    const movingSide: 1 | -1 = signedSide(ref, a, b) >= 0 ? 1 : -1;
    const keptSide: 1 | -1 = movingSide === 1 ? -1 : 1;
    const movingPoly = clipHalfPlane(layer.poly, a, b, movingSide);
    const keptPoly = clipHalfPlane(layer.poly, a, b, keptSide);
    if (movingPoly.length < 3 || area(movingPoly) < EPS_AREA) continue;
    const wholesale = keptPoly.length < 3 || area(keptPoly) < EPS_AREA;
    if (!wholesale) layer.poly = keptPoly;
    newLayers.push(wholesale ? makeFlap(layer, layer.poly, a, b, isFlatHalfTurn) : makeFlap(layer, movingPoly, a, b, isFlatHalfTurn));
    if (wholesale) layer.poly = [];
  }
  layers.push(...newLayers);
  return layers;
}

export function toRoot(l: L): Pt[] {
  return l.poly.map((p) => apply(l.localToRoot, p));
}

export function dedupe(poly: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of poly) {
    if (!out.some(([x, y]) => Math.abs(x - p[0]) < 1e-6 && Math.abs(y - p[1]) < 1e-6)) out.push(p);
  }
  return out;
}

// The REAL OrigamiModel's initial square (constructor in foldEngine.ts):
// axis-aligned, corners at (+-0.5,+-0.5). Native frame -- NOT the diamond
// frame some models below are decoded in.
const half = 0.5;
export const nativeSquare: Pt[] = [
  [-half, -half],
  [half, -half],
  [half, half],
  [-half, half],
];

/** Maps a point authored in the "diamond" frame (corners N,E,S,W on the axes,
 * radius 0.5) into the engine's native frame (rotate 45deg + scale sqrt(2),
 * which collapses to this simple form). Only use this for models actually
 * decoded from a diamond-oriented reference diagram -- a model authored
 * directly against the native square's own corners must NOT be piped
 * through this. */
export function diamond([x, y]: Pt): Pt {
  return [x - y, x + y];
}

export function freshLayers(): L[] {
  return [{ poly: nativeSquare.slice(), localToRoot: IDENTITY }];
}

// ============================================================
// CUP regression test (Japan Society "Origami Paper Cup" diagram, decoded in
// the diamond frame). Re-run whenever foldEngine.ts's fold math changes --
// must stay byte-identical to the cup as shipped in main.ts.
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('--- CUP regression ---');
  let cup = freshLayers();
  const N = diamond([0, 0.5]);
  const E = diamond([0.5, 0]);
  const S = diamond([0, -0.5]);
  const W = diamond([-0.5, 0]);

  cup = fold(cup, [W, E], 'all', S);
  console.log(`after stepA: ${cup.length} layers`);
  cup.forEach((l, i) => console.log(`  [${i}] area=${area(l.poly).toFixed(4)}`, dedupe(toRoot(l))));

  const P_W = diamond([-0.20710678118654752, 0.2928932188134525]);
  const Q_W = diamond([-0.08578643762690497, 0]);
  cup = fold(cup, [P_W, Q_W], 'all', W);
  console.log(`after stepB: ${cup.length} layers`);
  cup.forEach((l, i) => console.log(`  [${i}] area=${area(l.poly).toFixed(4)}`, dedupe(toRoot(l))));

  const P_E = diamond([0.20710678118654752, 0.2928932188134525]);
  const Q_E = diamond([0.08578643762690497, 0]);
  cup = fold(cup, [P_E, Q_E], 'all', E);
  console.log(`after stepC: ${cup.length} layers`);
  cup.forEach((l, i) => console.log(`  [${i}] area=${area(l.poly).toFixed(4)}`, dedupe(toRoot(l))));

  const APEX_Y = 1 - Math.sqrt(2) / 2;
  const APEX_TIP_X = Math.sqrt(2) / 2 - 0.5;
  const apexLine: [Pt, Pt] = [diamond([-APEX_TIP_X, APEX_Y]), diamond([APEX_TIP_X, APEX_Y])];

  cup = fold(cup, apexLine, [1], N);
  console.log(`after stepD (front=idx1): ${cup.length} layers`);
  cup.forEach((l, i) => console.log(`  [${i}] area=${area(l.poly).toFixed(4)}`, dedupe(toRoot(l))));

  cup = fold(cup, apexLine, [0], N);
  console.log(`after stepE (back=idx0): ${cup.length} layers`);
  cup.forEach((l, i) => console.log(`  [${i}] area=${area(l.poly).toFixed(4)}`, dedupe(toRoot(l))));
}
