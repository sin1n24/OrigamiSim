import * as THREE from 'three';
import { clipHalfPlane, layerGeometry, PAPER_THICKNESS, polygonArea, signedSide, type Pt } from './geometry';
import { type Affine, IDENTITY, MIRROR_Y, apply, compose, invert, rotation, translation } from './affine';

/**
 * One step in a fold sequence. `line` is always given in the ORIGINAL
 * sheet's coordinates ("root space") — the engine maps it into each target
 * layer's own local frame internally, using that layer's tracked
 * local-to-root transform. Layers are indexed by their position in
 * `OrigamiModel`'s running layer list (see `layerCount()`), in creation
 * order — index 0 is always the original sheet.
 *
 * Root-space authoring only stays valid for FLAT folds (angleDeg 0 or 180):
 * a flat fold keeps the flap coplanar with the rest of the paper, so its
 * local frame is still a plain 2D affine transform of root space (a
 * rotation/translation, plus a mirror for every 180° fold in its ancestry).
 * A non-flat fold (e.g. propping a flap up at some other angle) breaks that
 * — nothing folds onto such a flap in these models, so it's out of scope
 * rather than handled.
 */
export interface FoldStep {
  label: string;
  line: [Pt, Pt];
  targetLayers: number[] | 'all';
  /**
   * A root-space point known to sit on the side that should MOVE (fold).
   * Root-space +1/-1 side signs don't reliably carry over to a folded
   * layer's own local frame (a 180° fold mirrors it), so the engine derives
   * the actual clip sign per layer from this reference point instead of
   * taking a raw sign from the caller.
   */
  movingSidePoint: Pt;
  angleDeg: number;
}

interface Layer {
  poly: Pt[];
  mesh: THREE.Mesh;
  group: THREE.Object3D;
  localToRoot: Affine;
}

const EPS_AREA = 1e-9;

function polyAreaAbs(poly: Pt[]): number {
  return Math.abs(polygonArea(poly));
}

interface Hinge {
  group: THREE.Group;
  current: number;
  target: number;
}

/**
 * Guided paper-folding simulation: a stack of flat polygon "layers", folded
 * one crease at a time. Each fold clips the targeted layer(s) along a line,
 * turns the moving half into a new layer hinged at that line, and leaves the
 * kept half as the (shrunk) original layer in place — mirroring how a real
 * sheet of paper only gets more layers as you fold it, never fewer.
 *
 * Authored (and rendered) in the paper's own XY plane, with Z as the
 * thickness axis "out of the page" — the caller rotates the whole `root`
 * to lie flat in the scene's actual up axis.
 */
export class OrigamiModel {
  readonly root: THREE.Group;
  private layers: Layer[] = [];
  private hinges: Hinge[] = [];
  private stackCounter = 0;
  private readonly material: THREE.Material;

  constructor(size: number, material: THREE.Material) {
    this.material = material;
    this.root = new THREE.Group();
    const half = size / 2;
    const square: Pt[] = [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ];
    const mesh = new THREE.Mesh(layerGeometry(square), material);
    this.root.add(mesh);
    this.layers.push({ poly: square, mesh, group: this.root, localToRoot: IDENTITY });
  }

  layerCount(): number {
    return this.layers.length;
  }

  /** Debug/verification helper: this layer's current polygon, mapped into root-sheet coordinates. */
  rootSpacePolygon(layerIndex: number): Pt[] {
    const layer = this.layers[layerIndex];
    return layer.poly.map((p) => apply(layer.localToRoot, p));
  }

  /**
   * Visual guide for the next fold: draws the crease line (in each target
   * layer's OWN current frame, since a layer already folded into 3D isn't
   * flat in root space anymore) as a child of that layer's group. Caller
   * owns the returned objects and must remove+dispose them itself (e.g.
   * before showing the next step's preview).
   */
  previewCrease(step: FoldStep, color = 0xff5555): THREE.Object3D[] {
    const indices = step.targetLayers === 'all' ? this.layers.map((_, i) => i) : step.targetLayers;
    const lines: THREE.Object3D[] = [];
    for (const i of indices) {
      const layer = this.layers[i];
      if (layer.poly.length === 0) continue; // layer's paper has moved elsewhere (wholesale move)
      const rootToLocal = invert(layer.localToRoot);
      const a = apply(rootToLocal, step.line[0]);
      const b = apply(rootToLocal, step.line[1]);
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a[0], a[1], PAPER_THICKNESS * 2),
        new THREE.Vector3(b[0], b[1], PAPER_THICKNESS * 2),
      ]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
      layer.group.add(line);
      lines.push(line);
    }
    return lines;
  }

  /** Retarget an already-created hinge (index from `fold`'s return value) to a new rest angle. */
  setHingeTarget(hingeIndex: number, angleDeg: number): void {
    this.hinges[hingeIndex].target = THREE.MathUtils.degToRad(angleDeg);
  }

  /** Releases all GPU geometry this model allocated. Call before dropping the model instance. */
  dispose(): void {
    for (const layer of this.layers) {
      layer.mesh.geometry.dispose();
    }
  }

  /** Returns the indices (into the internal hinge list, stable across calls) of the hinges this fold created, in target order. */
  fold(step: FoldStep): number[] {
    // abs(abs(angle)-180): a -180deg fold mirrors the flap's local frame exactly like +180
    // does (it's the same physical fold, just animated by rotating the other way), so it
    // must trigger MIRROR_Y too. Missing this was a real bug -- the render looked right
    // (rotation.x=-PI lands the flap flat on the other face) but flapLocalToRoot silently
    // composed IDENTITY instead of MIRROR_Y, corrupting any later fold that targets this
    // layer. Verified the cup (which only ever uses +180) is byte-identical after this fix.
    const isFlatHalfTurn = Math.abs(Math.abs(step.angleDeg) - 180) < 1e-6;
    const isFlat = Math.abs(step.angleDeg) < 1e-6 || isFlatHalfTurn;
    if (!isFlat) {
      // Non-flat folds are fine to *perform*, just can't be built on top of via root-space authoring.
      console.warn(
        `fold "${step.label}": angleDeg=${step.angleDeg} is not a flat fold (0/180); later steps must target this flap in its own local coordinates.`,
      );
    }

    const indices = step.targetLayers === 'all' ? this.layers.map((_, i) => i) : step.targetLayers;
    const newLayers: Layer[] = [];
    const newHingeIndices: number[] = [];

    for (const i of indices) {
      const layer = this.layers[i];
      const rootToLocal = invert(layer.localToRoot);
      const aLocal = apply(rootToLocal, step.line[0]);
      const bLocal = apply(rootToLocal, step.line[1]);
      const refLocal = apply(rootToLocal, step.movingSidePoint);
      const movingSide: 1 | -1 = signedSide(refLocal, aLocal, bLocal) >= 0 ? 1 : -1;
      const keptSide: 1 | -1 = movingSide === 1 ? -1 : 1;

      const movingPoly = clipHalfPlane(layer.poly, aLocal, bLocal, movingSide);
      const keptPoly = clipHalfPlane(layer.poly, aLocal, bLocal, keptSide);

      // Crease doesn't actually reach this layer (moving side is empty/degenerate): leave untouched.
      if (movingPoly.length < 3 || polyAreaAbs(movingPoly) < EPS_AREA) continue;

      // Crease only grazes the kept side (kept side is empty/degenerate): the WHOLE layer moves,
      // nothing stays behind. Must be handled separately from a normal split, or `layer.poly =
      // keptPoly` would silently leave a zero-area ghost layer/mesh in the scene.
      const wholesaleMove = keptPoly.length < 3 || polyAreaAbs(keptPoly) < EPS_AREA;
      const flapSourcePoly = wholesaleMove ? layer.poly : movingPoly;

      if (!wholesaleMove) {
        layer.mesh.geometry.dispose();
        layer.mesh.geometry = layerGeometry(keptPoly);
        layer.poly = keptPoly;
      }

      const theta = Math.atan2(bLocal[1] - aLocal[1], bLocal[0] - aLocal[0]);

      // Two nested groups instead of one rotation.x+rotation.z Euler: Three.js's combined
      // Euler composition does NOT apply an object's own x/z rotations in the "z first to
      // orient, then x to fold around the oriented axis" order this fold math assumes (verified
      // empirically -- see CLAUDE.md). Two plain single-axis groups sidesteps Euler order
      // entirely: orientGroup's matrix (rotation.z=theta) is applied AFTER foldGroup's
      // (rotation.x=fold angle) simply because foldGroup is nested inside it.
      const orientGroup = new THREE.Group();
      orientGroup.position.set(aLocal[0], aLocal[1], 0);
      orientGroup.rotation.z = theta;
      const foldGroup = new THREE.Group();
      orientGroup.add(foldGroup);

      // hingeXform: flap's pre-rotation local coords -> layer-local coords (matches orientGroup above).
      const hingeXform = compose(translation(aLocal[0], aLocal[1]), rotation(theta));
      const rootToHinge = invert(hingeXform);
      const flapLocal: Pt[] = flapSourcePoly.map((p) => apply(rootToHinge, p));

      this.stackCounter += 1;
      const flapMesh = new THREE.Mesh(layerGeometry(flapLocal), this.material);
      // Flush stacking (offset by exactly one thickness per layer, no extra
      // gap) so consecutive sheets' side walls touch -- a gap here is what
      // caused the "cross-section has come apart" look (see geometry.ts).
      flapMesh.position.z = this.stackCounter * PAPER_THICKNESS;
      foldGroup.add(flapMesh);

      const flapLocalToRoot = compose(compose(layer.localToRoot, hingeXform), isFlatHalfTurn ? MIRROR_Y : IDENTITY);

      if (wholesaleMove) {
        // The whole layer became this flap: remove its old mesh instead of leaving a
        // zero-area zombie behind, and empty its poly so any later fold step that still
        // references this layer index (its paper has physically moved elsewhere now)
        // clips against nothing rather than re-processing stale full-size geometry.
        layer.group.remove(layer.mesh);
        layer.mesh.geometry.dispose();
        layer.poly = [];
        layer.group.add(orientGroup);
      } else {
        layer.group.add(orientGroup);
      }

      // Further folds targeting this new flap must nest under foldGroup (the "flat,
      // pre-fold" frame that flapLocal's own coordinates are expressed in), not orientGroup.
      newLayers.push({ poly: flapLocal, mesh: flapMesh, group: foldGroup, localToRoot: flapLocalToRoot });
      newHingeIndices.push(this.hinges.length);
      this.hinges.push({ group: foldGroup, current: 0, target: THREE.MathUtils.degToRad(step.angleDeg) });
    }

    this.layers.push(...newLayers);
    return newHingeIndices;
  }

  update(dt: number): void {
    const speed = 3.5;
    for (const h of this.hinges) {
      const k = 1 - Math.exp(-speed * dt);
      h.current += (h.target - h.current) * k;
      if (Math.abs(h.target - h.current) < 0.002) h.current = h.target;
      h.group.rotation.x = h.current;
    }
  }
}
