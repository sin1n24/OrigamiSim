import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Code-first modeling helper inspired by "Realitizer"
 * (https://zenn.dev/koher/articles/code-first-3d-modeling).
 * Chain: Shape2D.fromPoints(...).extrude(depth).beveled({...}).recalculateNormals().toMesh(material)
 */

export interface BevelOptions {
  width?: number;
  segments?: number;
}

interface SolidContext {
  shape: THREE.Shape;
  depth: number;
}

export class Solid {
  geometry: THREE.BufferGeometry;
  private ctx?: SolidContext;

  constructor(geometry: THREE.BufferGeometry, ctx?: SolidContext) {
    this.geometry = geometry;
    this.ctx = ctx;
  }

  beveled({ width = 0.05, segments = 2 }: BevelOptions = {}): Solid {
    if (!this.ctx) {
      throw new Error('beveled() can only follow extrude() (no shape context to rebuild from).');
    }
    const geometry = new THREE.ExtrudeGeometry(this.ctx.shape, {
      depth: this.ctx.depth,
      bevelEnabled: true,
      bevelThickness: width,
      bevelSize: width,
      bevelSegments: Math.max(1, segments),
      curveSegments: 24,
    });
    return new Solid(geometry, this.ctx);
  }

  recalculateNormals(): Solid {
    const merged = mergeVertices(this.geometry, 1e-4);
    merged.computeVertexNormals();
    return new Solid(merged, this.ctx);
  }

  toMesh(material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

export class Shape2D {
  private readonly shape: THREE.Shape;

  private constructor(shape: THREE.Shape) {
    this.shape = shape;
  }

  static fromPoints(points: Array<[number, number]>): Shape2D {
    const [first, ...rest] = points;
    if (!first) throw new Error('Shape2D.fromPoints requires at least one point.');
    const shape = new THREE.Shape();
    shape.moveTo(first[0], first[1]);
    for (const [x, y] of rest) shape.lineTo(x, y);
    shape.closePath();
    return new Shape2D(shape);
  }

  extrude(depth: number): Solid {
    const geometry = new THREE.ExtrudeGeometry(this.shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 24,
    });
    return new Solid(geometry, { shape: this.shape, depth });
  }
}
