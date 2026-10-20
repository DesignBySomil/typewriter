import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createSceneSystem } from './scene.js';
import { buildMachineChassis } from './machine.js';
import { buildKeysSystem } from './keys.js';
import { buildTypebarsSystem } from './typebars.js';
import { buildCarriageSystem } from './carriage.js';
import { createPaperSystem } from './paper.js';
import { TypewriterAudio } from './audio.js';
import { createHudSystem } from './hud.js';
import { createInputSystem } from './input.js';
import { createControlsSystem } from './controls.js';
import { createExportSystem } from './export.js';

const container = document.getElementById('webgl-container');
const sound = new TypewriterAudio();

// 1. Initialize Scene, Camera, Renderer, RoomEnvironment & Warm Matte Tabletop
const sceneSys = createSceneSystem(container);
const { renderer, scene, camera, bgScene, bgCamera, basketLight } = sceneSys;

// 2. Build 1963 Olivetti Lettera 32 Chassis, Screw Heads, Serial Plate, Covered Spools, Ribbon Switch & Vibrator
const chassis = buildMachineChassis(scene);

// 3. Build 44 Staggered Keys, Wide Shift Keys, Dusty Scuffed Spacebar & Linkage Rods
const keysSys = buildKeysSystem(chassis.machineRoot, chassis.materials);

// 4. Build Typebasket, 44 Dull Steel Typebars with Ink-Staining Slugs & Ink-Dust Emitter
const typebarsSys = buildTypebarsSystem(
  chassis.machineRoot,
  chassis.materials,
  keysSys.printableControllers
);

// 5. Build Carriage, Matte Rubber Platen, Indexed Ribbed Knobs, Margin Stops, Paper Release & Return Lever
const carriageSys = buildCarriageSystem(
  chassis.machineRoot,
  chassis.materials,
  keysSys.clickableMeshes
);

// 6. Build 80gsm Bond Paper Sheet & Letterpress Deboss Shader
const paperSys = createPaperSystem(carriageSys.carriageGroup);

// 7. Build SVG Telemetry HUD & Print/Save Export System
const hudSys = createHudSystem(camera, carriageSys.carriageGroup);
const exportSys = createExportSystem(paperSys);

// Expose export system on window.typewriter for programmatic inspection
window.typewriter = {
  export: exportSys
};

// User-adjustable margin stop columns (draggable via the 3D margin stops on the scale rail)
const userMargins = {
  leftCol: 0,
  rightCol: CONFIG.maxCols
};

function getActiveColumnBounds() {
  const isPortrait = (window.innerWidth / Math.max(1, window.innerHeight)) < 0.92;
  const defaultMin = isPortrait ? Math.floor((CONFIG.maxCols - CONFIG.portraitCols) * 0.5) : 0;
  const defaultMax = isPortrait ? defaultMin + CONFIG.portraitCols : CONFIG.maxCols;

  const minCol = Math.max(defaultMin, userMargins.leftCol);
  const maxCol = Math.min(defaultMax, userMargins.rightCol);
  return {
    minCol,
    maxCol,
    totalCols: Math.max(1, maxCol - minCol)
  };
}

const initialBounds = getActiveColumnBounds();
carriageSys.setMarginStopPositions(userMargins.leftCol, userMargins.rightCol);

// 8. Live Telemetry & Mechanical State
const telemetry = {
  col: initialBounds.minCol,
  pageLine: 0,
  totalLinesTyped: 0,
  strikes: 0,
  lastKeyLabel: '[NONE]',
  shiftDown: false,
  shiftLockedNext: false, // Tapping 3D Shift key toggles shift lock for next char
  paperReleased: false,
  marginLocked: false,
  ribbonColor: 'black',   // 'black' | 'red' | 'stencil'
  ribbonInk: 100.0,
  spoolAngle: 0.0,
  spoolDirection: 1,
  vibratorLiftY: 0,
  cameraShake: 0,
  cameraNudgeY: 0,
  lastStrikeTime: performance.now(),
  strikeIntervals: [175, 160, 185, 150, 170, 155, 145, 165, 150, 160],
  introDismissed: false
};

carriageSys.advanceToCol(telemetry.col, 0);

function dismissIntroPrompt() {
  if (telemetry.introDismissed) return;
  telemetry.introDismissed = true;
  const el = document.getElementById('intro-prompt');
  if (el) el.classList.add('hidden');
}

function updateShiftBasketVisuals() {
  const active = telemetry.shiftDown || telemetry.shiftLockedNext;
  typebarsSys.setBasketShift(active);
  const sl = keysSys.keyMap.get('ShiftLeft');
  const sr = keysSys.keyMap.get('ShiftRight');
  if (sl) sl.targetPress = active ? 0.24 : 0;
  if (sr) sr.targetPress = active ? 0.24 : 0;
}

function handlePrintableKey(ctrl, explicitChar = null) {
  sound.init();
  dismissIntroPrompt();

  const bounds = getActiveColumnBounds();
  if (telemetry.col < bounds.minCol) telemetry.col = bounds.minCol;

  keysSys.depressKey(ctrl, 0.34);
  sound.playKeyClack(0.95 + Math.random() * 0.1);

  const isUpper = telemetry.shiftDown || telemetry.shiftLockedNext;
  const charToPrint = explicitChar
    ? (telemetry.shiftLockedNext ? explicitChar.toUpperCase() : explicitChar)
    : (isUpper ? ctrl.upper : ctrl.lower);

  if (telemetry.shiftLockedNext) {
    telemetry.shiftLockedNext = false;
    updateShiftBasketVisuals();
  }

  telemetry.lastKeyLabel = `'${charToPrint}'`;

  if (telemetry.col >= bounds.maxCol) {
    telemetry.marginLocked = true;
    typebarsSys.triggerBarSwing(ctrl, true, null, telemetry.ribbonColor);
    sound.playCarriageAdvanceClick(0.01);
    hudSys.triggerBellFlash();
    return;
  }

  const now = performance.now();
  const dtMs = Math.min(500, Math.max(25, now - telemetry.lastStrikeTime));
  telemetry.lastStrikeTime = now;
  telemetry.strikeIntervals.push(dtMs);
  if (telemetry.strikeIntervals.length > 18) telemetry.strikeIntervals.shift();

  const targetCol = telemetry.col;
  const targetLineId = telemetry.totalLinesTyped;
  const targetRibbon = telemetry.ribbonColor;

  if (paperSys.isSheetPresent()) {
    paperSys.stampCharacter(charToPrint, targetCol, 0, targetRibbon, targetLineId);
  }

  telemetry.strikes++;
  telemetry.ribbonInk = Math.max(10.0, 100.0 - telemetry.strikes * 0.035);
  if (telemetry.strikes % 46 === 0) telemetry.spoolDirection *= -1;
  telemetry.spoolAngle += 0.095 * telemetry.spoolDirection;
  chassis.spoolGroupLeft.rotation.y = telemetry.spoolAngle;
  chassis.spoolGroupRight.rotation.y = telemetry.spoolAngle;

  telemetry.col = Math.min(bounds.maxCol, telemetry.col + 1);
  carriageSys.advanceToCol(telemetry.col, -0.42);

  if (telemetry.col === bounds.maxCol - CONFIG.bellOffset) {
    sound.playMarginBell();
    hudSys.triggerBellFlash();
  }
  if (telemetry.col >= bounds.maxCol) {
    telemetry.marginLocked = true;
  }

  typebarsSys.triggerBarSwing(ctrl, false, () => {
    carriageSys.triggerPlatenRecoil();
    if (targetRibbon !== 'stencil') {
      typebarsSys.triggerInkDustPuff(targetRibbon);
    }
    telemetry.vibratorLiftY = targetRibbon === 'red' ? 0.22 : (targetRibbon === 'stencil' ? 0.0 : 0.13);
    telemetry.cameraShake = 0.012;
    telemetry.cameraNudgeY = -0.020;
    sound.playStrikeImpact();
  }, targetRibbon);
}

function handleSpace() {
  sound.init();
  dismissIntroPrompt();

  const bounds = getActiveColumnBounds();
  const sc = keysSys.keyMap.get('Space');
  keysSys.depressKey(sc, 0.26);
  telemetry.lastKeyLabel = 'SPACE';
  sound.playKeyClack(0.82);

  if (telemetry.col >= bounds.maxCol) {
    telemetry.marginLocked = true;
    hudSys.triggerBellFlash();
    return;
  }

  telemetry.col++;
  carriageSys.advanceToCol(telemetry.col, -0.34);
  sound.playCarriageAdvanceClick(0.02);

  if (telemetry.col === bounds.maxCol - CONFIG.bellOffset) {
    sound.playMarginBell();
    hudSys.triggerBellFlash();
  }
  if (telemetry.col >= bounds.maxCol) {
    telemetry.marginLocked = true;
  }
}

function handleBackspace() {
  sound.init();
  dismissIntroPrompt();

  const bounds = getActiveColumnBounds();
  const bc = keysSys.keyMap.get('Backspace');
  keysSys.depressKey(bc, 0.28);
  telemetry.lastKeyLabel = 'BACK';
  sound.playKeyClack(1.08);

  if (telemetry.col > bounds.minCol) {
    telemetry.col--;
    telemetry.marginLocked = false;
    carriageSys.advanceToCol(telemetry.col, 0.34);
    sound.playCarriageAdvanceClick(0.02);
  }
}

function handleCarriageReturn() {
  sound.init();
  dismissIntroPrompt();

  const bounds = getActiveColumnBounds();
  const ec = keysSys.keyMap.get('Enter');
  keysSys.depressKey(ec, 0.28);
  telemetry.lastKeyLabel = 'CR / LF';

  const distanceRatio = Math.max(0.2, (telemetry.col - bounds.minCol) / bounds.totalCols);
  sound.playCarriageReturn(distanceRatio);

  telemetry.col = bounds.minCol;
  telemetry.marginLocked = false;
  telemetry.totalLinesTyped++;

  carriageSys.triggerCarriageReturnMotion(bounds.minCol);

  if (!paperSys.isSheetPresent()) {
    paperSys.triggerNewSheetInsert();
    telemetry.pageLine = 0;
    return;
  }

  telemetry.pageLine++;
  if (telemetry.pageLine >= CONFIG.maxLinesPerPage) {
    telemetry.pageLine = 0;
    paperSys.triggerNewSheetInsert();
  } else {
    paperSys.rollCanvasTextUpOneLine();
    paperSys.triggerLineFeedWave();
  }
}

function handleShiftChange(mode) {
  if (mode === 'toggle') {
    handleShiftToggleLock();
    return;
  }
  const nextState = Boolean(mode);
  if (telemetry.shiftDown === nextState) return;
  telemetry.shiftDown = nextState;
  updateShiftBasketVisuals();

  if (nextState) {
    sound.init();
    sound.playKeyClack(0.76);
  }
}

function handleShiftToggleLock() {
  sound.init();
  dismissIntroPrompt();
  telemetry.shiftLockedNext = !telemetry.shiftLockedNext;
  telemetry.lastKeyLabel = telemetry.shiftLockedNext ? 'SHIFT LOCK' : 'SHIFT UNLK';
  sound.playKeyClack(0.78);
  updateShiftBasketVisuals();
}

function handleCycleRibbonMode() {
  sound.init();
  dismissIntroPrompt();
  const tc = keysSys.keyMap.get('Tab');
  keysSys.depressKey(tc, 0.24);
  sound.playKeyClack(1.12);

  const order = ['black', 'red', 'stencil'];
  const nextIdx = (order.indexOf(telemetry.ribbonColor) + 1) % order.length;
  telemetry.ribbonColor = order[nextIdx];

  chassis.setRibbonModeVisual(telemetry.ribbonColor);

  const labelMap = { black: 'RIB: BLK', red: 'RIB: RED', stencil: 'RIB: STN' };
  const btnMap = { black: 'RIBBON: BLK', red: 'RIBBON: RED', stencil: 'RIBBON: STN' };
  telemetry.lastKeyLabel = labelMap[telemetry.ribbonColor];

  const btnRibbon = document.getElementById('btn-ribbon');
  if (btnRibbon) {
    btnRibbon.textContent = btnMap[telemetry.ribbonColor];
    btnRibbon.classList.toggle('warn', telemetry.ribbonColor === 'red');
    btnRibbon.classList.toggle('active', telemetry.ribbonColor === 'stencil');
  }
}

function handlePlatenLineFeed(deltaLines, snapToLine = true) {
  sound.init();
  dismissIntroPrompt();
  carriageSys.rotatePlatenByLines(deltaLines);
  if (snapToLine) {
    sound.playCarriageAdvanceClick(0.0);
  }
  if (paperSys.isSheetPresent()) {
    const newLine = paperSys.scrollByLines(deltaLines, snapToLine);
    telemetry.pageLine = Math.max(0, Math.min(CONFIG.maxLinesPerPage - 1, newLine));
  }
  telemetry.lastKeyLabel = deltaLines > 0 ? 'KNOB UP' : 'KNOB DN';
}

function handleUpdateMargins(side, targetCol) {
  sound.init();
  if (side === 'left') {
    userMargins.leftCol = THREE.MathUtils.clamp(targetCol, 0, userMargins.rightCol - 10);
  } else {
    userMargins.rightCol = THREE.MathUtils.clamp(targetCol, userMargins.leftCol + 10, CONFIG.maxCols);
  }
  carriageSys.setMarginStopPositions(userMargins.leftCol, userMargins.rightCol);

  const bounds = getActiveColumnBounds();
  if (telemetry.col < bounds.minCol) {
    telemetry.col = bounds.minCol;
    carriageSys.advanceToCol(telemetry.col, 0.15);
  } else if (telemetry.col > bounds.maxCol) {
    telemetry.col = bounds.maxCol;
    telemetry.marginLocked = true;
    carriageSys.advanceToCol(telemetry.col, -0.15);
  } else {
    telemetry.marginLocked = false;
  }
  telemetry.lastKeyLabel = `MRG ${userMargins.leftCol + 1}-${userMargins.rightCol}`;
}

function handleTogglePaperRelease() {
  sound.init();
  dismissIntroPrompt();
  telemetry.paperReleased = !telemetry.paperReleased;
  carriageSys.setPaperReleased(telemetry.paperReleased);
  sound.playKeyClack(1.18);
  telemetry.lastKeyLabel = telemetry.paperReleased ? 'PAPER FREE' : 'PAPER LOCK';
}

function handleRemoveOrInsertPaper(mode = 'toggle') {
  sound.init();
  dismissIntroPrompt();
  const bounds = getActiveColumnBounds();

  if (mode === 'insert' || !paperSys.isSheetPresent()) {
    sound.playCarriageReturn(0.5);
    telemetry.col = bounds.minCol;
    telemetry.pageLine = 0;
    telemetry.marginLocked = false;
    carriageSys.triggerCarriageReturnMotion(bounds.minCol);
    paperSys.triggerNewSheetInsert();
    telemetry.lastKeyLabel = 'SHEET IN';
  } else {
    sound.playCarriageReturn(0.35);
    paperSys.triggerPaperEject();
    telemetry.lastKeyLabel = 'SHEET OUT';
  }
}

function handleToggleHudVisibility() {
  document.body.classList.toggle('hud-hidden');
}

// 9. Wire PRINT / SAVE Panel & Controls
const printSavePanel = document.getElementById('print-save-panel');
function isExportPanelOpen() {
  return printSavePanel && !printSavePanel.classList.contains('hidden');
}
function closeExportPanel() {
  if (printSavePanel) printSavePanel.classList.add('hidden');
}
function toggleExportPanel() {
  if (printSavePanel) printSavePanel.classList.toggle('hidden');
}

document.getElementById('btn-print-save')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleExportPanel();
});
document.getElementById('btn-print-save-m')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleExportPanel();
});
document.getElementById('btn-export-close')?.addEventListener('click', (e) => {
  e.stopPropagation();
  closeExportPanel();
});
document.getElementById('btn-export-png')?.addEventListener('click', (e) => {
  e.stopPropagation();
  exportSys.downloadPNG();
  closeExportPanel();
});
document.getElementById('btn-export-pdf')?.addEventListener('click', (e) => {
  e.stopPropagation();
  exportSys.downloadPDF();
  closeExportPanel();
});
document.getElementById('btn-export-print')?.addEventListener('click', (e) => {
  e.stopPropagation();
  exportSys.printPage();
  closeExportPanel();
});

// 10. Wire Keyboard Input System & 3D Interactive Controls System
const inputSys = createInputSystem({
  rendererDom: renderer.domElement,
  keyMap: keysSys.keyMap,
  charToKeyMap: keysSys.charToKeyMap,
  onPrintableKey: handlePrintableKey,
  onSpace: handleSpace,
  onBackspace: handleBackspace,
  onCarriageReturn: handleCarriageReturn,
  onShiftChange: handleShiftChange,
  onToggleRibbonColor: handleCycleRibbonMode,
  onToggleHudVisibility: handleToggleHudVisibility,
  onPrintShortcut: () => exportSys.printPage(),
  isExportPanelOpen,
  onCloseExportPanel: closeExportPanel
});

createControlsSystem({
  rendererDom: renderer.domElement,
  camera,
  chassis,
  keysSys,
  carriageSys,
  paperSys,
  onPrintableKey: handlePrintableKey,
  onSpace: handleSpace,
  onBackspace: handleBackspace,
  onCarriageReturn: handleCarriageReturn,
  onShiftToggleLock: handleShiftToggleLock,
  onCycleRibbonMode: handleCycleRibbonMode,
  onPlatenLineFeed: handlePlatenLineFeed,
  onUpdateMargins: handleUpdateMargins,
  onTogglePaperRelease: handleTogglePaperRelease,
  onRemoveOrInsertPaper: handleRemoveOrInsertPaper,
  onTouchCanvasFocus: () => inputSys.focusMobileKeyboard()
});

document.getElementById('btn-return')?.addEventListener('click', () => handleCarriageReturn());
document.getElementById('btn-ribbon')?.addEventListener('click', () => handleCycleRibbonMode());
document.getElementById('btn-sheet')?.addEventListener('click', () => handleRemoveOrInsertPaper('toggle'));
document.getElementById('btn-sheet-m')?.addEventListener('click', () => handleRemoveOrInsertPaper('toggle'));

const btnMute = document.getElementById('btn-mute');
btnMute?.addEventListener('click', () => {
  sound.init();
  const isMuted = sound.toggleMute();
  btnMute.textContent = isMuted ? 'AUDIO: MUTED' : 'AUDIO: ON';
  btnMute.classList.toggle('active', !isMuted);
  btnMute.classList.toggle('warn', isMuted);
});

window.addEventListener('resize', () => {
  sceneSys.handleResize();
  hudSys.layoutHud();
  const b = getActiveColumnBounds();
  if (telemetry.col < b.minCol) {
    telemetry.col = b.minCol;
    carriageSys.advanceToCol(telemetry.col, 0);
  } else if (telemetry.col > b.maxCol) {
    telemetry.col = b.maxCol;
    carriageSys.advanceToCol(telemetry.col, 0);
  }
});

// 11. Main 60fps Animation & Render Loop
const clock = new THREE.Clock();
let elapsedTotal = 0;
const smoothPointer = new THREE.Vector2(0, 0);
const currentLookAt = new THREE.Vector3();
const camOffsetVec = new THREE.Vector3();
const spherical = new THREE.Spherical();

function animate() {
  requestAnimationFrame(animate);

  inputSys.processQueue();

  const dt = Math.min(0.05, clock.getDelta());
  elapsedTotal += dt;

  sceneSys.bgUniforms.uTime.value = elapsedTotal;

  basketLight.intensity = 0.38 + Math.sin(elapsedTotal * 1.6) * 0.03;

  keysSys.updateKeys(dt);
  typebarsSys.updateTypebars(dt);
  carriageSys.updateCarriage(dt);
  chassis.updateMachineLevers(dt);
  paperSys.updatePaper(dt, elapsedTotal);

  telemetry.vibratorLiftY *= Math.exp(-dt * 24.0);
  chassis.vibratorGroup.position.y = 2.66 + telemetry.vibratorLiftY;

  const introProgress = Math.min(1.0, elapsedTotal / 2.0);
  const introEase = 1.0 - Math.pow(1.0 - introProgress, 3.0);

  smoothPointer.x += (inputSys.pointerNDC.x - smoothPointer.x) * Math.min(1.0, dt * 5.0);
  smoothPointer.y += (inputSys.pointerNDC.y - smoothPointer.y) * Math.min(1.0, dt * 5.0);

  const basePose = sceneSys.computeFittedCameraPose();
  const introPush = (1.0 - introEase) * 1.4;

  camOffsetVec.copy(basePose.pos).sub(basePose.lookAt);
  spherical.setFromVector3(camOffsetVec);

  const maxParallaxRad = THREE.MathUtils.degToRad(3.0);
  const idleDriftAzimuth = Math.sin(elapsedTotal * 0.45) * 0.005;
  const idleDriftPolar   = Math.cos(elapsedTotal * 0.35) * 0.004;

  spherical.theta += smoothPointer.x * maxParallaxRad + idleDriftAzimuth;
  spherical.phi = THREE.MathUtils.clamp(
    spherical.phi - smoothPointer.y * maxParallaxRad * 0.75 + idleDriftPolar,
    0.25,
    Math.PI * 0.46
  );
  spherical.radius += introPush;

  camOffsetVec.setFromSpherical(spherical);

  telemetry.cameraShake *= Math.exp(-dt * 30.0);
  telemetry.cameraNudgeY *= Math.exp(-dt * 22.0);
  const shakeX = (Math.random() - 0.5) * telemetry.cameraShake;
  const shakeY = (Math.random() - 0.5) * telemetry.cameraShake + telemetry.cameraNudgeY;

  camera.position.copy(basePose.lookAt).add(camOffsetVec);
  camera.position.x += shakeX;
  camera.position.y += shakeY;

  currentLookAt.copy(basePose.lookAt);
  currentLookAt.x += smoothPointer.x * 0.10;
  currentLookAt.y += smoothPointer.y * 0.06 + shakeY * 0.65;
  camera.lookAt(currentLookAt);

  hudSys.updateHud(telemetry, getActiveColumnBounds());

  renderer.clear();
  renderer.render(bgScene, bgCamera);
  renderer.clearDepth();
  renderer.render(scene, camera);
}

animate();
