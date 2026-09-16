// Simple sailboat, structure from origamisho.com's "Type1" (simplest, no
// squash-fold) yacht: fold to triangle -> fold left corner to right corner
// (halving again) -> fold a corner to shape the hull -> "open" to stand the
// sail up. The photo sequence's exact hull-fold proportions weren't
// resolvable precisely from photos (no diagram with measurements), so the
// hull crease below is a deliberate clean choice verified to produce a
// sensible small hull-bow flap, not a pixel-match. Decoded in the diamond
// frame.
import { diamond, fold, freshLayers, report, type Pt } from './engine.ts';

let layers = freshLayers();
const N = diamond([0, 0.5]);
const E = diamond([0.5, 0]);
const S = diamond([0, -0.5]);
const W = diamond([-0.5, 0]);
const ORIGIN = diamond([0, 0]);

// Step 1: fold S up to N, crease W-E -> triangle N,E,W kept (layer0=back), moved (layer1=front).
layers = fold(layers, [W, E], 'all', S);
report('step1 (fold in half)', layers);

// Step 2: fold W to E, crease = vertical N-S line -> quarters down to a
// right triangle N,E,(0,0), 4 layers all coincident.
layers = fold(layers, [N, S], 'all', W);
report('step2 (fold left to right)', layers);

// Step 3: fold the bottom-left corner (0,0) of the OUTERMOST layer (the
// last one created, sitting on top of the stack) up to shape the hull bow.
const hullLayer = layers.length - 1;
layers = fold(layers, [diamond([0.15, 0]), diamond([0, 0.15])], [hullLayer], ORIGIN);
report('step3 (fold hull bow)', layers);
