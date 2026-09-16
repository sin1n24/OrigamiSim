import * as THREE from 'three';
import type { FoldNet, Hinge } from '../scenes/foldPrototype';

export type FlapState = 'flat' | 'folded';

interface HingeAnim {
  hinge: Hinge;
  current: number; // degrees, animated toward `target`
  target: number;
}

/**
 * Click-to-fold puzzle state machine.
 *
 * The player folds each flap by clicking it: left-click folds one way,
 * right-click the other (the caller passes which as `direction`). Which
 * direction is actually correct is never revealed per-flap — folding
 * doesn't recolor a panel green or orange, so there's no instant feedback
 * to trial-and-error against. Clicking an already-folded flap unfolds it
 * (and cascades: its whole folded subtree resets to flat, since a child's
 * position only makes sense relative to an already-folded parent). A flap
 * can only be folded once its parent is folded, in either direction.
 *
 * The player commits with `confirm()` once every flap is folded; it
 * reports whether the shape is actually correct, and which flaps (if any)
 * are folded the wrong way, without auto-solving anything.
 */
export class FoldGame {
  private readonly net: FoldNet;
  private readonly children = new Map<string | null, Hinge[]>();
  private readonly state = new Map<string, FlapState>();
  private readonly direction = new Map<string, 1 | -1>();
  private readonly anim = new Map<string, HingeAnim>();
  private moveCount = 0;

  onInvalidClick?: (id: string) => void;
  onChange?: () => void;
  onSolved?: () => void;
  onIncorrect?: (wrongIds: string[]) => void;

  constructor(net: FoldNet) {
    this.net = net;
    for (const h of net.hinges) {
      this.state.set(h.id, 'flat');
      this.anim.set(h.id, { hinge: h, current: 0, target: 0 });
      const bucket = this.children.get(h.parent) ?? [];
      bucket.push(h);
      this.children.set(h.parent, bucket);
    }
  }

  getMoveCount(): number {
    return this.moveCount;
  }

  getState(id: string): FlapState {
    return this.state.get(id) ?? 'flat';
  }

  canInteract(id: string): boolean {
    const hinge = this.net.hinges.find((h) => h.id === id);
    if (!hinge) return false;
    if (hinge.parent === null) return true;
    return this.state.get(hinge.parent) !== 'flat';
  }

  clickableMeshes(): THREE.Mesh[] {
    return this.net.hinges.map((h) => h.mesh);
  }

  hingeIdForMesh(mesh: THREE.Object3D): string | null {
    for (const h of this.net.hinges) if (h.mesh === mesh) return h.id;
    return null;
  }

  allFolded(): boolean {
    return this.net.hinges.every((h) => this.state.get(h.id) === 'folded');
  }

  /** left/right click on a flap: fold it (direction) if flat, unfold if already folded. */
  interact(id: string, direction: 1 | -1): 'ok' | 'blocked' {
    if (!this.canInteract(id)) {
      this.onInvalidClick?.(id);
      return 'blocked';
    }
    const cur = this.state.get(id) ?? 'flat';
    if (cur === 'flat') {
      this.setFolded(id, direction);
    } else {
      this.resetSubtree(id);
    }
    this.moveCount += 1;
    this.onChange?.();
    return 'ok';
  }

  private setFolded(id: string, direction: 1 | -1): void {
    const hinge = this.net.hinges.find((h) => h.id === id)!;
    this.state.set(id, 'folded');
    this.direction.set(id, direction);
    const cur = this.anim.get(id)!.current;
    this.anim.set(id, { hinge, current: cur, target: direction * hinge.correctDeg });
  }

  private resetSubtree(id: string): void {
    const hinge = this.net.hinges.find((h) => h.id === id)!;
    this.state.set(id, 'flat');
    this.direction.delete(id);
    const cur = this.anim.get(id)!.current;
    this.anim.set(id, { hinge, current: cur, target: 0 });
    for (const child of this.children.get(id) ?? []) this.resetSubtree(child.id);
  }

  /** Evaluate the current fold once every flap has been folded one way or the other. */
  confirm(): void {
    if (!this.allFolded()) return;
    const wrong = this.net.hinges.filter((h) => this.direction.get(h.id) !== 1).map((h) => h.id);
    if (wrong.length === 0) this.onSolved?.();
    else this.onIncorrect?.(wrong);
  }

  reset(): void {
    for (const h of this.net.hinges) this.resetSubtree(h.id);
    this.moveCount = 0;
    this.onChange?.();
  }

  /** Advance hinge rotations toward their targets; call once per animation frame. */
  update(dt: number): void {
    const speed = 6; // 1/s convergence rate, exponential ease
    for (const a of this.anim.values()) {
      const k = 1 - Math.exp(-speed * dt);
      a.current += (a.target - a.current) * k;
      if (Math.abs(a.target - a.current) < 0.05) a.current = a.target;
      const rad = THREE.MathUtils.degToRad(a.current);
      if (a.hinge.axis === 'x') a.hinge.group.rotation.x = rad;
      else a.hinge.group.rotation.z = rad;
    }
  }
}
