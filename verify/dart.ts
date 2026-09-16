// Classic paper dart / airplane (origamisho.com square-paper version): fold
// in half -> fold both top corners to center (creating the nose) -> fold
// both new edges to center AGAIN (narrowing the nose) -> fold in half ->
// fold down each wing. Authored in the engine's NATIVE frame directly (the
// paper starts in normal book/square orientation, not a diamond), so no
// diamond() transform here -- see CLAUDE.md's frame-per-model note.
import { fold, freshLayers, report, type Pt } from './engine.ts';

let layers = freshLayers();
const TL: Pt = [-0.5, 0.5];
const TR: Pt = [0.5, 0.5];
const BL: Pt = [-0.5, -0.5];
const BR: Pt = [0.5, -0.5];
const TC: Pt = [0, 0.5];
const LC: Pt = [-0.5, 0];
const RC: Pt = [0.5, 0];

// Step 1: fold TL down to center (0,0) -- crease TC-LC is the perpendicular
// bisector of TL-to-center (a right isoceles triangle's own hypotenuse).
layers = fold(layers, [TC, LC], 'all', TL);
report('step1 (fold top-left corner to center)', layers);

// Step 2: mirror for TR.
layers = fold(layers, [TC, RC], 'all', TR);
report('step2 (fold top-right corner to center)', layers);
// Now the "roof" is one solid triangle TC,LC,RC (apex up), matching the
// reference photo -- both corner-flaps plus the kept pentagon share that
// footprint.

// Step 3: fold the new left edge (apex to LC) to the centerline AGAIN,
// narrowing the nose. Crease from apex TC to a point on the base -- solved
// the same way as step1/2 (perpendicular-bisector-style angle reflection):
// x = sqrt(2)/2 - 0.5 = 0.20710678, the same constant that showed up in the
// cup's apex crease (not a coincidence -- same "fold edge onto centerline"
// geometry).
const NOSE_X = Math.sqrt(2) / 2 - 0.5;
layers = fold(layers, [TC, [-NOSE_X, 0]], 'all', LC);
report('step3 (narrow nose, left)', layers);

// Step 4: mirror for the right edge.
layers = fold(layers, [TC, [NOSE_X, 0]], 'all', RC);
report('step4 (narrow nose, right)', layers);

// Step 5: fold in half (left to right) -- crease is the vertical centerline.
layers = fold(layers, [TC, [0, -0.5]], 'all', LC);
report('step5 (fold in half)', layers);

// Step 6: fold down one wing on the OUTERMOST layer -- crease from a point
// partway up the spine (x=0) out to the bottom-right corner BR (where BL
// ended up after step 5's half-fold). Wing angle/size isn't stated by any
// source with a precise measurement (it's a flight-performance choice even
// in real tutorials); this is a clean, deliberate pick, not a pixel-match.
const wingLayer = layers.length - 1;
layers = fold(layers, [[0, 0.1], BR], [wingLayer], TC);
report('step6 (fold wing)', layers);
