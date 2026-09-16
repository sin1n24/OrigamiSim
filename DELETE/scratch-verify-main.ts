// Replays main.ts's exact fold calls against the REAL OrigamiModel square
// (axis-aligned corners at +-0.5,+-0.5, per foldEngine.ts's constructor) using
// the same pure-2D math (no THREE.js), to check whether main.ts's diamond-frame
// coordinates (N,E,S,W on the axes) actually match that square's geometry.
import { clipHalfPlane, signedSide, type Pt } from './src/origami/geometry.ts';
import { type Affine, IDENTITY, MIRROR_Y, apply, compose, invert, rotation, translation } from './src/origami/affine.ts';

interface L {
  poly: Pt[];
  localToRoot: Affine;
}
const EPS_AREA = 1e-9;

function area(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
}

function makeFlap(layer: L, poly: Pt[], a: Pt, b: Pt): L {
  const theta = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const hingeXform = compose(translation(a[0], a[1]), rotation(theta));
  const rootToHinge = invert(hingeXform);
  const flapLocal = poly.map((p) => apply(rootToHinge, p));
  const flapLocalToRoot = compose(compose(layer.localToRoot, hingeXform), MIRROR_Y);
  return { poly: flapLocal, localToRoot: flapLocalToRoot };
}

// Mimics OrigamiModel.fold(): kept layers stay AT THE SAME INDEX (mutated in
// place); newly-created flaps are appended to the end only after the whole
// targeted set has been processed (not interleaved per-layer).
function fold(layers: L[], line: [Pt, Pt], targets: number[] | 'all', movingSidePointRoot: Pt): L[] {
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
    newLayers.push(wholesale ? makeFlap(layer, layer.poly, a, b) : makeFlap(layer, movingPoly, a, b));
    if (wholesale) layer.poly = [];
  }
  layers.push(...newLayers);
  return layers;
}

function toRoot(l: L): Pt[] {
  return l.poly.map((p) => apply(l.localToRoot, p));
}

// The REAL OrigamiModel's initial square (constructor in foldEngine.ts):
const half = 0.5;
const realSquare: Pt[] = [
  [-half, -half],
  [half, -half],
  [half, half],
  [-half, half],
];

let layers: L[] = [{ poly: realSquare, localToRoot: IDENTITY }];

function diamond([x, y]: Pt): Pt {
  return [x - y, x + y];
}

const N = diamond([0, 0.5]);
const E = diamond([0.5, 0]);
const S = diamond([0, -0.5]);
const W = diamond([-0.5, 0]);

layers = fold(layers, [W, E], 'all', S);
console.log(`after stepA: ${layers.length} layers`);
layers.forEach((l, i) => console.log(`  [${i}] area=${area(l.poly).toFixed(4)}`, toRoot(l)));

const P_W = diamond([-0.20710678118654752, 0.2928932188134525]);
const Q_W = diamond([-0.08578643762690497, 0]);
layers = fold(layers, [P_W, Q_W], 'all', W);
console.log(`after stepB: ${layers.length} layers`);
layers.forEach((l, i) => console.log(`  [${i}] area=${area(l.poly).toFixed(4)}`, toRoot(l)));

const P_E = diamond([0.20710678118654752, 0.2928932188134525]);
const Q_E = diamond([0.08578643762690497, 0]);
layers = fold(layers, [P_E, Q_E], 'all', E);
console.log(`after stepC: ${layers.length} layers`);
layers.forEach((l, i) => console.log(`  [${i}] area=${area(l.poly).toFixed(4)}`, toRoot(l)));

const APEX_Y = 1 - Math.sqrt(2) / 2;
const apexLine: [Pt, Pt] = [diamond([-1, APEX_Y]), diamond([1, APEX_Y])];
console.log('apexLine', apexLine, 'APEX_Y', APEX_Y);

layers = fold(layers, apexLine, [1], N);
console.log(`after stepD (front=idx1): ${layers.length} layers`);
layers.forEach((l, i) => console.log(`  [${i}] area=${area(l.poly).toFixed(4)}`, toRoot(l)));

layers = fold(layers, apexLine, [0], N);
console.log(`after stepE (back=idx0): ${layers.length} layers`);
layers.forEach((l, i) => console.log(`  [${i}] area=${area(l.poly).toFixed(4)}`, toRoot(l)));
