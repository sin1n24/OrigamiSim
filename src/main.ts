import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OrigamiModel } from './origami/foldEngine';
import { MODELS, type ModelDef } from './origami/models';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d10);

// While folding, a steep near-top-down angle is deliberate: at a grazing oblique angle,
// thin coincident paper layers can look falsely separated due to perspective distortion
// even when their root-space polygons match exactly (see CLAUDE.md pitfalls). But once a
// model pops open into an actual 3D shape, that same steep angle flattens it back down to
// near-illegible (a wall that's now standing up reads as a thin sliver from directly
// above). onComplete() eases the camera to the shallower DISPLAY angle instead;
// startModel() snaps it back to FOLDING for the next model.
const FOLDING_CAMERA_POS = new THREE.Vector3(0.8, 2.4, 1.2);
const FOLDING_CAMERA_TARGET = new THREE.Vector3(0, 0.4, 0);
const DISPLAY_CAMERA_POS = new THREE.Vector3(1.5, 0.95, 1.6);
const DISPLAY_CAMERA_TARGET = new THREE.Vector3(0, 0.55, 0);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.copy(FOLDING_CAMERA_POS);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.copy(FOLDING_CAMERA_TARGET);
let cameraTween: { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; t: number } | null = null;

function tweenCameraTo(toPos: THREE.Vector3, toTarget: THREE.Vector3): void {
  cameraTween = { fromPos: camera.position.clone(), toPos: toPos.clone(), fromTarget: controls.target.clone(), toTarget: toTarget.clone(), t: 0 };
}

function snapCameraTo(pos: THREE.Vector3, target: THREE.Vector3): void {
  cameraTween = null;
  camera.position.copy(pos);
  controls.target.copy(target);
}

scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 5, 2);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const material = new THREE.MeshStandardMaterial({
  color: 0xf2e4c8,
  roughness: 0.7,
  side: THREE.DoubleSide,
});

// --- Game state --------------------------------------------------------
let model: OrigamiModel | null = null;
let currentModelDef: ModelDef | null = null;
let stepIndex = 0;
let stepHinges: number[][] = []; // hinge indices returned by fold(), one entry per completed step
let previewLines: THREE.Object3D[] = [];

function disposePreview(): void {
  for (const obj of previewLines) {
    obj.parent?.remove(obj);
    if (obj instanceof THREE.Line) {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    }
  }
  previewLines = [];
}

function showPreview(): void {
  disposePreview();
  if (model && currentModelDef && stepIndex < currentModelDef.steps.length) {
    previewLines = model.previewCrease(currentModelDef.steps[stepIndex]);
  }
}

function createModel(): OrigamiModel {
  const m = new OrigamiModel(1, material);
  m.root.rotation.x = -Math.PI / 2; // lie flat on the XZ table, Y up
  m.root.position.y = 0.4;
  return m;
}

function startModel(def: ModelDef): void {
  disposePreview();
  if (model) {
    scene.remove(model.root);
    model.dispose();
  }
  currentModelDef = def;
  model = createModel();
  scene.add(model.root);
  stepIndex = 0;
  stepHinges = [];
  overlay.style.display = 'none';
  selectOverlay.style.display = 'none';
  snapCameraTo(FOLDING_CAMERA_POS, FOLDING_CAMERA_TARGET);
  showPreview();
  updateHud();
}

function showModelSelect(): void {
  overlay.style.display = 'none';
  disposePreview();
  selectOverlay.style.display = 'flex';
}

function onComplete(): void {
  if (!model || !currentModelDef) return;
  for (const reveal of currentModelDef.openReveal ?? []) {
    const hingeIndex = stepHinges[reveal.stepIndex]?.[reveal.hingeSlot];
    if (hingeIndex !== undefined) model.setHingeTarget(hingeIndex, reveal.angleDeg);
  }
  tweenCameraTo(DISPLAY_CAMERA_POS, DISPLAY_CAMERA_TARGET);
  overlay.style.display = 'flex';
}

function advanceStep(): void {
  if (!model || !currentModelDef) return;
  if (stepIndex >= currentModelDef.steps.length) return;
  const newHinges = model.fold(currentModelDef.steps[stepIndex]);
  stepHinges.push(newHinges);
  stepIndex++;
  if (stepIndex >= currentModelDef.steps.length) {
    disposePreview();
    onComplete();
  } else {
    showPreview();
  }
  updateHud();
}

// --- HUD -----------------------------------------------------------------
const hud = document.createElement('div');
hud.className = 'hud';
const panel = document.createElement('div');
panel.className = 'hud-panel';
const progressEl = document.createElement('div');
progressEl.className = 'hud-progress';
const titleEl = document.createElement('div');
titleEl.className = 'hud-title';
const hintEl = document.createElement('div');
hintEl.className = 'hud-hint';
const buttonsEl = document.createElement('div');
buttonsEl.className = 'hud-buttons';
const resetButton = document.createElement('button');
resetButton.className = 'hud-button';
resetButton.textContent = 'はじめから';
resetButton.addEventListener('click', () => currentModelDef && startModel(currentModelDef));
const chooseButton = document.createElement('button');
chooseButton.className = 'hud-button';
chooseButton.textContent = 'モデルを選ぶ';
chooseButton.addEventListener('click', () => showModelSelect());
buttonsEl.append(resetButton, chooseButton);
panel.append(progressEl, titleEl, hintEl, buttonsEl);
hud.appendChild(panel);
app.appendChild(hud);

// --- Completion overlay ----------------------------------------------------
const overlay = document.createElement('div');
overlay.className = 'win-overlay';
overlay.style.display = 'none';
const winCard = document.createElement('div');
winCard.className = 'win-card';
const winTitle = document.createElement('div');
winTitle.className = 'win-title';
winTitle.textContent = 'できあがり!';
const winHint = document.createElement('div');
winHint.className = 'win-moves';
const againButton = document.createElement('button');
againButton.className = 'hud-button hud-button-primary';
againButton.textContent = 'もう一度折る';
againButton.addEventListener('click', () => currentModelDef && startModel(currentModelDef));
const otherButton = document.createElement('button');
otherButton.className = 'hud-button';
otherButton.textContent = '他のモデルを選ぶ';
otherButton.addEventListener('click', () => showModelSelect());
winCard.append(winTitle, winHint, againButton, otherButton);
overlay.appendChild(winCard);
app.appendChild(overlay);

// --- Model select overlay ---------------------------------------------------
const selectOverlay = document.createElement('div');
selectOverlay.className = 'win-overlay';
selectOverlay.style.display = 'none';
const selectCard = document.createElement('div');
selectCard.className = 'win-card';
const selectTitle = document.createElement('div');
selectTitle.className = 'win-title';
selectTitle.textContent = '折り紙を選ぶ';
const selectList = document.createElement('div');
selectList.className = 'hud-buttons';
for (const def of MODELS) {
  const btn = document.createElement('button');
  btn.className = 'hud-button hud-button-primary';
  btn.textContent = def.name;
  btn.addEventListener('click', () => startModel(def));
  selectList.appendChild(btn);
}
selectCard.append(selectTitle, selectList);
selectOverlay.appendChild(selectCard);
app.appendChild(selectOverlay);

function updateHud(): void {
  if (!currentModelDef) return;
  if (stepIndex < currentModelDef.steps.length) {
    progressEl.textContent = `${currentModelDef.name} ・ ステップ ${stepIndex + 1} / ${currentModelDef.steps.length}`;
    titleEl.textContent = currentModelDef.steps[stepIndex].label;
    hintEl.textContent = '赤い線が次の折り目です。紙をクリックして折りましょう。';
  } else {
    progressEl.textContent = `${currentModelDef.name} ・ ステップ ${currentModelDef.steps.length} / ${currentModelDef.steps.length}`;
    titleEl.textContent = 'できあがり!';
    hintEl.textContent = '';
  }
  winHint.textContent = `伝統的な折り紙の「${currentModelDef.name}」が完成しました。`;
}

// --- Click-to-fold (pointerdown/pointerup distance threshold distinguishes a
// click from an OrbitControls camera-drag gesture) ---------------------------
let pointerDown: { x: number; y: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerDown) return;
  const dx = e.clientX - pointerDown.x;
  const dy = e.clientY - pointerDown.y;
  pointerDown = null;
  if (Math.hypot(dx, dy) <= 6) advanceStep();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

(window as any).__debug = {
  get model() {
    return model;
  },
  get currentModelDef() {
    return currentModelDef;
  },
  camera,
  controls,
  THREE,
  advance: advanceStep,
  reset: () => currentModelDef && startModel(currentModelDef),
  select: showModelSelect,
  startModel,
  MODELS,
};

showModelSelect();

const CAMERA_TWEEN_DURATION = 0.9;
let lastTime = performance.now();
function tick(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  model?.update(dt);
  if (cameraTween) {
    cameraTween.t = Math.min(1, cameraTween.t + dt / CAMERA_TWEEN_DURATION);
    const e = 1 - Math.pow(1 - cameraTween.t, 3); // ease-out cubic
    camera.position.lerpVectors(cameraTween.fromPos, cameraTween.toPos, e);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, e);
    if (cameraTween.t >= 1) cameraTween = null;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
