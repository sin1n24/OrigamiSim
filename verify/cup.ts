// Regression test for the cup (Japan Society "Origami Paper Cup" diagram,
// decoded in the diamond frame). Re-run whenever foldEngine.ts's fold math
// changes -- must stay byte-identical to the cup as shipped in main.ts.
import { diamond, fold, freshLayers, report, type Pt } from './engine.ts';

let cup = freshLayers();
const N = diamond([0, 0.5]);
const E = diamond([0.5, 0]);
const S = diamond([0, -0.5]);
const W = diamond([-0.5, 0]);

cup = fold(cup, [W, E], 'all', S);
report('stepA', cup);

const P_W = diamond([-0.20710678118654752, 0.2928932188134525]);
const Q_W = diamond([-0.08578643762690497, 0]);
cup = fold(cup, [P_W, Q_W], 'all', W);
report('stepB', cup);

const P_E = diamond([0.20710678118654752, 0.2928932188134525]);
const Q_E = diamond([0.08578643762690497, 0]);
cup = fold(cup, [P_E, Q_E], 'all', E);
report('stepC', cup);

const APEX_Y = 1 - Math.sqrt(2) / 2;
const APEX_TIP_X = Math.sqrt(2) / 2 - 0.5;
const apexLine: [Pt, Pt] = [diamond([-APEX_TIP_X, APEX_Y]), diamond([APEX_TIP_X, APEX_Y])];

cup = fold(cup, apexLine, [1], N);
report('stepD (front=idx1)', cup);

cup = fold(cup, apexLine, [0], N);
report('stepE (back=idx0)', cup);
