import * as THREE from 'three';

/** A 2D point in the paper's own working plane (XY; Z is paper thickness/"up out of the page"). */
export type Pt = [number, number];

/** Sign of the cross product (b-a) x (p-a): which side of line a->b point p is on. */
export function signedSide(p: Pt, a: Pt, b: Pt): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

/**
 * Sutherland–Hodgman half-plane clip. Splits `poly` along the infinite line
 * through (a, b) and returns only the part on the side given by `keepSign`
 * (the sign `signedSide` must have to be kept).
 */
export function clipHalfPlane(poly: Pt[], a: Pt, b: Pt, keepSign: 1 | -1): Pt[] {
  const intersect = (p: Pt, q: Pt): Pt => {
    const d1 = signedSide(p, a, b) * keepSign;
    const d2 = signedSide(q, a, b) * keepSign;
    const t = d1 / (d1 - d2);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
  };

  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const next = poly[(i + 1) % poly.length];
    const curIn = signedSide(cur, a, b) * keepSign >= -1e-9;
    const nextIn = signedSide(next, a, b) * keepSign >= -1e-9;
    if (curIn) out.push(cur);
    if (curIn !== nextIn) out.push(intersect(cur, next));
  }
  return out;
}

// Paper has a small but non-zero thickness: fully flat (zero-depth) layers
// made it impossible to tell that a shape has multiple stacked sheets at
// all. But the ORIGINAL extruded thickness (0.012) was stacked with a GAP
// bigger than the extrusion itself (depth*1.2 per layer), so consecutive
// layers' side walls didn't touch -- at a fold line that reads as two
// stacked layers whose cross-section has visibly come apart, rather than a
// single continuous fold. Fix: keep the depth small ("practically zero" but
// perceptible) AND stack layers FLUSH (offset by exactly PAPER_THICKNESS,
// no extra gap), so consecutive sheets' side walls touch with no visible
// slit.
export const PAPER_THICKNESS = 0.0015;

/** Thin mesh for one polygon layer, lying in the local XY plane (Z = thickness). */
export function layerGeometry(poly: Pt[]): THREE.BufferGeometry {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: PAPER_THICKNESS,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geo.translate(0, 0, -PAPER_THICKNESS / 2);
  return geo;
}

/** Signed area (shoelace); positive = counter-clockwise. Used to sanity-check clip output. */
export function polygonArea(poly: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}
