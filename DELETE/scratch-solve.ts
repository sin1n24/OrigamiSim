// Solve for the cup's step-3 corner fold crease from two stated constraints:
//  (a) folded corner W lands on edge N-E (x+y=0.5)
//  (b) the image of segment P-W (part of edge W-N) is horizontal
// where P = point on edge W-N at parameter s, Q = point on base edge W-E at parameter u,
// crease = line P-Q.
type Pt = [number, number];

const W: Pt = [-0.5, 0];
const N: Pt = [0, 0.5];
const E: Pt = [0.5, 0];

function P(s: number): Pt {
  return [W[0] + s * (N[0] - W[0]), W[1] + s * (N[1] - W[1])];
}
function Q(u: number): Pt {
  return [W[0] + u * (E[0] - W[0]), W[1] + u * (E[1] - W[1])];
}

function reflect(pt: Pt, a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const vx = pt[0] - a[0];
  const vy = pt[1] - a[1];
  const t = (vx * dx + vy * dy) / len2;
  const projx = a[0] + t * dx;
  const projy = a[1] + t * dy;
  return [2 * projx - pt[0], 2 * projy - pt[1]];
}

function residual(s: number, u: number): [number, number] {
  const p = P(s);
  const q = Q(u);
  const wPrime = reflect(W, p, q);
  const ra = wPrime[0] + wPrime[1] - 0.5; // (a)
  const rb = wPrime[1] - p[1]; // (b)
  return [ra, rb];
}

// crude 2D Newton solve via finite differences
let s = 0.5;
let u = 0.5;
for (let iter = 0; iter < 100; iter++) {
  const [f1, f2] = residual(s, u);
  const h = 1e-6;
  const [f1s, f2s] = residual(s + h, u);
  const [f1u, f2u] = residual(s, u + h);
  const df1ds = (f1s - f1) / h;
  const df2ds = (f2s - f2) / h;
  const df1du = (f1u - f1) / h;
  const df2du = (f2u - f2) / h;
  // solve J * delta = -f
  const det = df1ds * df2du - df1du * df2ds;
  const ds = (-f1 * df2du + f2 * df1du) / det;
  const du = (-df1ds * f2 + df2ds * f1) / det;
  s += ds;
  u += du;
  if (Math.abs(ds) < 1e-14 && Math.abs(du) < 1e-14) break;
}

console.log('s=', s, 'u=', u);
const p = P(s);
const q = Q(u);
console.log('P=', p, 'Q=', q);
const wPrime = reflect(W, p, q);
console.log("W'=", wPrime);
console.log('check (a) x+y=0.5:', wPrime[0] + wPrime[1]);
console.log('check (b) P.y == Wprime.y:', p[1], wPrime[1]);
