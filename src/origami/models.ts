import type { FoldStep } from './foldEngine';

/** Retargets a hinge created by an earlier step to a new rest angle once the
 * model is fully folded, e.g. to pop a flat-folded shape open into 3D.
 * `stepIndex` is the index into that model's own `steps` array; `hingeSlot`
 * indexes into the array `fold()` returned for that step (most steps create
 * exactly one hinge per target layer, in target order). */
export interface OpenReveal {
  stepIndex: number;
  hingeSlot: number;
  angleDeg: number;
}

export interface ModelDef {
  id: string;
  name: string;
  steps: FoldStep[];
  openReveal?: OpenReveal[];
}

/** Maps a point authored in a "diamond" frame (corners N,E,S,W on the axes,
 * radius 0.5) into OrigamiModel's native frame (axis-aligned square, corners
 * at (+-0.5,+-0.5)) -- rotate 45deg + scale sqrt(2), which collapses to this
 * simple form. Use this ONLY for a model decoded from a diamond-oriented
 * reference diagram; a model authored directly against the native square's
 * own corners (e.g. a corner-to-center blintz fold) must NOT go through this.
 */
function diamond([x, y]: [number, number]): [number, number] {
  return [x - y, x + y];
}

// ============================================================
// Cup: "Origami Paper Cup", The Japan Society & Japan Foundation (KD&TN).
// https://www.japansociety.org.uk/rsn/lessons/resources/RSN-Resources-OrigamiCup.pdf
// Decoded in the diamond frame -- see CLAUDE.md for the derivation of steps
// B/C's crease lines from the diagram's two stated constraints ("meet the
// other side" / "parallel with the bottom edge"). Verified in verify/cup.ts.
// ============================================================
function buildCup(): ModelDef {
  const N = diamond([0, 0.5]);
  const E = diamond([0.5, 0]);
  const S = diamond([0, -0.5]);
  const W = diamond([-0.5, 0]);

  const P_W = diamond([-0.20710678118654752, 0.2928932188134525]);
  const Q_W = diamond([-0.08578643762690497, 0]);
  const P_E = diamond([0.20710678118654752, 0.2928932188134525]);
  const Q_E = diamond([0.08578643762690497, 0]);

  const APEX_Y = 1 - Math.sqrt(2) / 2;
  const APEX_TIP_X = Math.sqrt(2) / 2 - 0.5; // = 1 - APEX_Y, the two corner-fold tips' x-offset
  const apexLine: [[number, number], [number, number]] = [diamond([-APEX_TIP_X, APEX_Y]), diamond([APEX_TIP_X, APEX_Y])];

  return {
    id: 'cup',
    name: '紙コップ',
    steps: [
      { label: '半分に折る', line: [W, E], targetLayers: 'all', movingSidePoint: S, angleDeg: 180 },
      { label: '左の角を折る', line: [P_W, Q_W], targetLayers: 'all', movingSidePoint: W, angleDeg: 180 },
      { label: '右の角を折る', line: [P_E, Q_E], targetLayers: 'all', movingSidePoint: E, angleDeg: 180 },
      { label: '前の三角を折り込む', line: apexLine, targetLayers: [1], movingSidePoint: N, angleDeg: 180 },
      { label: '後ろの三角を折り込む', line: apexLine, targetLayers: [0], movingSidePoint: N, angleDeg: 180 },
    ],
    // Step 0 (半分に折る) creates exactly one hinge (the front body, layer 1).
    // Retargeting it from fully-flat (180) to a partway-open angle pops the
    // whole folded shape into an actual 3D cup: everything folded onto the
    // front body (its own corner + apex flaps) rides along via the scene
    // graph. The back body never moves, so this reads as the front wall
    // tilting open away from a flat back.
    openReveal: [{ stepIndex: 0, hingeSlot: 0, angleDeg: 115 }],
  };
}

// ============================================================
// Mountain (山): the simplest possible model, needing no reference diagram
// (a single diagonal fold is unambiguous) -- fold the square in half along
// its diagonal, then reopen that same hinge partway so the two triangular
// halves stand up as a ridge, like a tent/mountain silhouette.
// ============================================================
function buildMountain(): ModelDef {
  const N = diamond([0, 0.5]);
  const S = diamond([0, -0.5]);
  const W = diamond([-0.5, 0]);

  return {
    id: 'mountain',
    name: '山',
    steps: [{ label: '対角線に折る', line: [N, S], targetLayers: 'all', movingSidePoint: W, angleDeg: 180 }],
    openReveal: [{ stepIndex: 0, hingeSlot: 0, angleDeg: 80 }],
  };
}

/** Perpendicular bisector of segment a-b, as two points defining that line. */
function perpBisector(a: [number, number], b: [number, number]): [[number, number], [number, number]] {
  const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dir: [number, number] = [-(b[1] - a[1]), b[0] - a[0]];
  return [
    [mid[0] - dir[0], mid[1] - dir[1]],
    [mid[0] + dir[0], mid[1] + dir[1]],
  ];
}

// ============================================================
// Fox face: structure from origamijapan.net/fox-face/ (6-step diagram: fold
// in half -> crease-only reference [skipped, no geometry change] -> fold
// apex down partway -> fold two corners up into ears -> turn over [skipped]
// -> draw face [skipped]). Neither that source nor origamiway.com's verbal
// description ("fold toward the center, but not all the way") states exact
// ear proportions -- origamiway explicitly leaves it to the folder. The ear
// target points below are a deliberate choice, verified in verify/fox.ts to
// leave a substantial face remaining and to make each ear tip clear the
// trapezoid's top edge. Decoded in the diamond frame.
// ============================================================
function buildFox(): ModelDef {
  const N = diamond([0, 0.5]);
  const E = diamond([0.5, 0]);
  const S = diamond([0, -0.5]);
  const W = diamond([-0.5, 0]);

  const apexLine: [[number, number], [number, number]] = [diamond([-0.5, 0.25]), diamond([0.5, 0.25])];
  const EAR_TARGET_X = 0.1;
  const EAR_TARGET_Y = 0.4;
  const [Pw1, Pw2] = perpBisector([-0.5, 0], [-EAR_TARGET_X, EAR_TARGET_Y]);
  const [Pe1, Pe2] = perpBisector([0.5, 0], [EAR_TARGET_X, EAR_TARGET_Y]);

  return {
    id: 'fox',
    name: 'きつねの顔',
    steps: [
      { label: '半分に折る', line: [W, E], targetLayers: 'all', movingSidePoint: S, angleDeg: 180 },
      { label: '上の角を折る', line: apexLine, targetLayers: 'all', movingSidePoint: N, angleDeg: 180 },
      { label: '左の耳を折る', line: [diamond(Pw1), diamond(Pw2)], targetLayers: 'all', movingSidePoint: W, angleDeg: 180 },
      { label: '右の耳を折る', line: [diamond(Pe1), diamond(Pe2)], targetLayers: 'all', movingSidePoint: E, angleDeg: 180 },
    ],
  };
}

// ============================================================
// Yacht: structure from origamisho.com's "Type1" (simplest, no-squash)
// yacht photo sequence -- fold to triangle -> fold left corner to right
// corner -> fold a corner to shape the hull -> open to stand the sail up.
// The photos didn't give precise hull-fold measurements (no diagram with
// stated proportions, unlike the cup), so the hull crease is a deliberate
// clean choice verified in verify/yacht.ts to produce a sensible small
// hull-bow flap without collapsing the sail. Decoded in the diamond frame.
// ============================================================
function buildYacht(): ModelDef {
  const N = diamond([0, 0.5]);
  const E = diamond([0.5, 0]);
  const S = diamond([0, -0.5]);
  const W = diamond([-0.5, 0]);
  const ORIGIN = diamond([0, 0]);

  return {
    id: 'yacht',
    name: 'ヨット',
    steps: [
      { label: '半分に折る', line: [W, E], targetLayers: 'all', movingSidePoint: S, angleDeg: 180 },
      { label: '左を右に折る', line: [N, S], targetLayers: 'all', movingSidePoint: W, angleDeg: 180 },
      // After step 2 ('all' on 2 layers) there are exactly 4 layers (0,1
      // kept in place; 2,3 newly appended); layer 3 is the outermost flap.
      { label: '船首を折る', line: [diamond([0.15, 0]), diamond([0, 0.15])], targetLayers: [3], movingSidePoint: ORIGIN, angleDeg: 180 },
    ],
    // Step 0's hinge controls the front half (sail); reopening it partway
    // tilts the sail up away from the flat hull/back half, standing the
    // boat up -- the same trick as the cup's reveal.
    openReveal: [{ stepIndex: 0, hingeSlot: 0, angleDeg: 130 }],
  };
}

// ============================================================
// Paper dart / airplane: classic construction from origamisho.com's
// square-paper version -- fold both top corners to center (nose) -> fold
// those edges to center again (narrow the nose) -> fold in half -> fold
// down a wing. Authored in the engine's NATIVE frame directly (the paper
// starts in normal book/square orientation, not a diamond) -- do NOT pipe
// these through diamond(). Verified in verify/dart.ts (area-conservation
// checks out exactly through all 6 folds despite several degenerate/
// wholesale-move layers along the way).
// ============================================================
function buildDart(): ModelDef {
  const TL: [number, number] = [-0.5, 0.5];
  const TR: [number, number] = [0.5, 0.5];
  const TC: [number, number] = [0, 0.5];
  const LC: [number, number] = [-0.5, 0];
  const RC: [number, number] = [0.5, 0];
  const BOTTOM: [number, number] = [0, -0.5];
  const BR: [number, number] = [0.5, -0.5];
  // Same constant as the cup's apex crease -- both are "fold an edge onto
  // the centerline" reflections and share the same angle geometry.
  const NOSE_X = Math.sqrt(2) / 2 - 0.5;

  return {
    id: 'dart',
    name: '紙飛行機',
    steps: [
      { label: '左上の角を折る', line: [TC, LC], targetLayers: 'all', movingSidePoint: TL, angleDeg: 180 },
      { label: '右上の角を折る', line: [TC, RC], targetLayers: 'all', movingSidePoint: TR, angleDeg: 180 },
      { label: '先端を細くする(左)', line: [TC, [-NOSE_X, 0]], targetLayers: 'all', movingSidePoint: LC, angleDeg: 180 },
      { label: '先端を細くする(右)', line: [TC, [NOSE_X, 0]], targetLayers: 'all', movingSidePoint: RC, angleDeg: 180 },
      { label: '半分に折る', line: [TC, BOTTOM], targetLayers: 'all', movingSidePoint: LC, angleDeg: 180 },
      // After step 5 ('all' folds accumulating through several degenerate/
      // wholesale-move splits) there are exactly 11 layers (0..10); layer
      // 10 is the outermost, freshly-created flap.
      { label: '翼を折る', line: [[0, 0.1], BR], targetLayers: [10], movingSidePoint: TC, angleDeg: 180 },
    ],
  };
}

export const MODELS: ModelDef[] = [buildCup(), buildFox(), buildYacht(), buildDart(), buildMountain()];
