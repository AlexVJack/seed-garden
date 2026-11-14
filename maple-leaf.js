import * as THREE from 'three';

// A small solid five-lobed silhouette, shared by the crown and fallen leaves.
const shape = new THREE.Shape();
const outline = [
  [0, -0.55], [0.07, -0.28], [0.38, -0.38], [0.29, -0.12],
  [0.67, 0.06], [0.48, 0.15], [0.58, 0.43], [0.3, 0.33],
  [0.28, 0.65], [0.13, 0.49], [0, 0.88], [-0.13, 0.49],
  [-0.28, 0.65], [-0.3, 0.33], [-0.58, 0.43], [-0.48, 0.15],
  [-0.67, 0.06], [-0.29, -0.12], [-0.38, -0.38], [-0.07, -0.28],
];
outline.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
shape.closePath();
export const mapleLeafGeometry = new THREE.ExtrudeGeometry(shape, {
  depth: 0.035, bevelEnabled: false, steps: 1, curveSegments: 1,
});
mapleLeafGeometry.translate(0, 0, -0.0175);
