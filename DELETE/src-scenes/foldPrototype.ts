import * as THREE from 'three';

/**
 * Parameterized box net builder: a flat base panel with up to 4 wall flaps
 * (hinged directly to the base) and an optional lid flap (hinged to the
 * east wall, two levels deep). Each flap is a THREE.Group pivoting at the
 * edge it shares with its parent panel, so folding is a local rotation from
 * 0 (flat, matching the net layout) to a signed target angle (perpendicular,
 * forming the box). Object3D transforms compose through the hierarchy, so a
 * flap-of-a-flap (the lid, hinged to the east wall) folds correctly with no
 * extra bookkeeping once its own hinge position is right.
 *
 * Gotcha (hit once, worth keeping in mind when adding deeper chains): a
 * flap's own mesh sits `outwardSize/2` into its hinge group, so its own far
 * edge — where a grandchild would hinge — is at local offset `outwardSize`,
 * not `outwardSize / 2`.
 */

export interface Hinge {
  id: string;
  /** id of the parent hinge, or null if the parent is the fixed base panel */
  parent: string | null;
  axis: 'x' | 'z';
  /** signed angle (deg) that folds this flap into its correct position */
  correctDeg: number;
  group: THREE.Group;
  mesh: THREE.Mesh;
}

export interface FoldNet {
  root: THREE.Group;
  hinges: Hinge[];
}

export const PANEL_THICKNESS = 0.035;

function flatPanelGeometry(sizeX: number, sizeZ: number): THREE.BufferGeometry {
  // A thin box (not a zero-thickness plane) so panels read as chunky physical
  // tiles. Centered on Y like PlaneGeometry would be, so the XZ footprint —
  // and every hinge position computed from it — is unaffected by thickness.
  return new THREE.BoxGeometry(sizeX, PANEL_THICKNESS, sizeZ);
}

const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0b0d10, transparent: true, opacity: 0.55 });

function addEdgeOutline(mesh: THREE.Mesh): void {
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMaterial);
  mesh.add(edges);
}

function makeFlap(
  parent: THREE.Object3D,
  hingeLocalPos: THREE.Vector3,
  outwardAxis: 'x' | 'z',
  outwardSign: 1 | -1,
  alongHingeSize: number,
  outwardSize: number,
  material: THREE.Material,
): { hinge: THREE.Group; mesh: THREE.Mesh } {
  const hinge = new THREE.Group();
  hinge.position.copy(hingeLocalPos);
  parent.add(hinge);

  const sizeX = outwardAxis === 'x' ? outwardSize : alongHingeSize;
  const sizeZ = outwardAxis === 'z' ? outwardSize : alongHingeSize;
  const mesh = new THREE.Mesh(flatPanelGeometry(sizeX, sizeZ), material);
  mesh.position.set(
    outwardAxis === 'x' ? (outwardSign * outwardSize) / 2 : 0,
    0,
    outwardAxis === 'z' ? (outwardSign * outwardSize) / 2 : 0,
  );
  addEdgeOutline(mesh);
  hinge.add(mesh);

  return { hinge, mesh };
}

export interface BoxNetOptions {
  /** X extent of the base panel */
  width: number;
  /** Z extent of the base panel */
  depth: number;
  wallHeight: number;
  withLid: boolean;
  material: THREE.Material;
}

export function buildBoxNet(opts: BoxNetOptions): FoldNet {
  const { width, depth, wallHeight, withLid, material } = opts;

  const root = new THREE.Group();
  const base = new THREE.Mesh(flatPanelGeometry(width, depth), material);
  addEdgeOutline(base);
  root.add(base);

  const hinges: Hinge[] = [];

  function addFlap(
    id: string,
    parentGroup: THREE.Object3D,
    parentId: string | null,
    hingeLocalPos: THREE.Vector3,
    outwardAxis: 'x' | 'z',
    outwardSign: 1 | -1,
    alongHingeSize: number,
    outwardSize: number,
    rotationAxis: 'x' | 'z',
    correctDeg: number,
  ): THREE.Group {
    const { hinge, mesh } = makeFlap(
      parentGroup,
      hingeLocalPos,
      outwardAxis,
      outwardSign,
      alongHingeSize,
      outwardSize,
      material,
    );
    hinges.push({ id, parent: parentId, axis: rotationAxis, correctDeg, group: hinge, mesh });
    return hinge;
  }

  addFlap(
    'west', root, null,
    new THREE.Vector3(-width / 2, 0, 0), 'x', -1, depth, wallHeight, 'z', -90,
  );
  const east = addFlap(
    'east', root, null,
    new THREE.Vector3(width / 2, 0, 0), 'x', 1, depth, wallHeight, 'z', 90,
  );
  addFlap(
    'north', root, null,
    new THREE.Vector3(0, 0, -depth / 2), 'z', -1, width, wallHeight, 'x', 90,
  );
  addFlap(
    'south', root, null,
    new THREE.Vector3(0, 0, depth / 2), 'z', 1, width, wallHeight, 'x', -90,
  );

  if (withLid) {
    // hinges to east's own far edge, which sits at local x = wallHeight
    // within east's hinge frame (not wallHeight / 2 — see gotcha above).
    addFlap(
      'lid', east, 'east',
      new THREE.Vector3(wallHeight, 0, 0), 'x', 1, depth, width, 'z', 90,
    );
  }

  return { root, hinges };
}
