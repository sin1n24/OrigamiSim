// Fox face, structure from origamijapan.net/fox-face/ (6-step diagram: fold
// in half -> crease-only reference -> fold apex down partway -> fold two
// corners up into ears -> turn over -> draw face) and origamiway.com's
// verbal note that the ear fold goes "toward the center, but not all the
// way." Neither source states exact proportions (the second explicitly says
// so), so the ear-fold TARGET POINTS below are a deliberate choice verified
// to (a) leave a substantial face remaining and (b) make the ear tip extend
// above the trapezoid's top edge -- not a pixel-match to one diagram. The
// STEP STRUCTURE (half-fold, apex partial fold, two corner ear-folds) is
// what's taken from the real references. Decoded in the diamond frame.
import { diamond, fold, freshLayers, report, type Pt } from './engine.ts';

let layers = freshLayers();
const N = diamond([0, 0.5]);
const E = diamond([0.5, 0]);
const S = diamond([0, -0.5]);
const W = diamond([-0.5, 0]);

// Step 1: fold S up to N, crease W-E -> triangle N,E,W kept.
layers = fold(layers, [W, E], 'all', S);
report('step1 (fold in half)', layers);

// Step 2 in the diagram is a crease-and-unfold reference only (vertical
// centerline); no geometry change, so no fold() call, and it's skipped in
// the game's step list too.

// Step 3: fold the apex N down to the BASE MIDPOINT (0,0) -- crease
// horizontal at y=0.25 (halfway between apex y=0.5 and base y=0).
layers = fold(layers, [diamond([-0.5, 0.25]), diamond([0.5, 0.25])], 'all', N);
report('step3 (fold apex down to base midpoint)', layers);

// Step 4: fold W up toward (-0.1, 0.4) -- "not all the way to center," high
// enough that the ear tip pokes up above the trapezoid's top edge (y=0.25).
function perpBisector(a: Pt, b: Pt): [Pt, Pt] {
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dir: Pt = [-(b[1] - a[1]), b[0] - a[0]];
  return [
    [mid[0] - dir[0], mid[1] - dir[1]],
    [mid[0] + dir[0], mid[1] + dir[1]],
  ];
}
const EAR_TARGET_X = 0.1;
const EAR_TARGET_Y = 0.4;
const [Pw1, Pw2] = perpBisector([-0.5, 0], [-EAR_TARGET_X, EAR_TARGET_Y]);
layers = fold(layers, [diamond(Pw1), diamond(Pw2)], 'all', W);
report('step4 (fold left ear)', layers);

// Step 5: mirror of step 4.
const [Pe1, Pe2] = perpBisector([0.5, 0], [EAR_TARGET_X, EAR_TARGET_Y]);
layers = fold(layers, [diamond(Pe1), diamond(Pe2)], 'all', E);
report('step5 (fold right ear)', layers);
