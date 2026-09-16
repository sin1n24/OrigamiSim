import type { Pt } from './geometry';

/**
 * Minimal 2D affine transform: x' = a*x + c*y + tx; y' = b*x + d*y + ty.
 * Used to track, for every paper layer, the transform from that layer's own
 * local 2D frame back to the root sheet's original coordinates — so fold
 * steps can be authored once in root coordinates instead of hand-derived
 * per-layer local coordinates (which is exactly the mistake this engine
 * replaced: see CLAUDE.md).
 */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

export function translation(x: number, y: number): Affine {
  return { a: 1, b: 0, c: 0, d: 1, tx: x, ty: y };
}

export function rotation(theta: number): Affine {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return { a: cos, b: sin, c: -sin, d: cos, tx: 0, ty: 0 };
}

/** Reflects the y coordinate — what a 180° flat fold does to everything hinged past it. */
export const MIRROR_Y: Affine = { a: 1, b: 0, c: 0, d: -1, tx: 0, ty: 0 };

/** m1 ∘ m2: apply m2 first, then m1 (matches `compose(m1, m2)(p) === apply(m1, apply(m2, p))`). */
export function compose(m1: Affine, m2: Affine): Affine {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
    ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty,
  };
}

export function apply(m: Affine, p: Pt): Pt {
  return [m.a * p[0] + m.c * p[1] + m.tx, m.b * p[0] + m.d * p[1] + m.ty];
}

export function invert(m: Affine): Affine {
  const det = m.a * m.d - m.c * m.b;
  const a = m.d / det;
  const b = -m.b / det;
  const c = -m.c / det;
  const d = m.a / det;
  return { a, b, c, d, tx: -(a * m.tx + c * m.ty), ty: -(b * m.tx + d * m.ty) };
}
