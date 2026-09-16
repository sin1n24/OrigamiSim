import type { BoxNetOptions } from '../scenes/foldPrototype';

export interface LevelDef {
  id: string;
  name: string;
  hint: string;
  net: Omit<BoxNetOptions, 'material'>;
}

export const LEVELS: LevelDef[] = [
  {
    id: 'l1-open-box',
    name: 'Level 1 — ふたなし箱',
    hint: '左右クリックで折る向きを選べる。全部折ったら確定しよう',
    net: { width: 1.3, depth: 0.9, wallHeight: 0.55, withLid: false },
  },
  {
    id: 'l2-closed-box',
    name: 'Level 2 — ふた付き箱',
    hint: 'ふたは壁(東側)を折ってからでないと折れない',
    net: { width: 1, depth: 1, wallHeight: 0.6, withLid: true },
  },
  {
    id: 'l3-tall-box',
    name: 'Level 3 — 縦長の箱',
    hint: '見た目に惑わされず、正しい向きを見極めよう',
    net: { width: 0.7, depth: 1.4, wallHeight: 0.9, withLid: true },
  },
];
