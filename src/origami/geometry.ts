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

const PAPER_THICKNESS = 0.012;

/** Thin flat mesh for one polygon layer, lying in the local XY plane (Z = thickness). */
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

export { PAPER_THICKNESS };

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
