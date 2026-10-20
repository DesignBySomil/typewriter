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

const container = document.getElementById('webgl-container');
const sound = new TypewriterAudio();

// 1. Initialize Scene, Camera, Renderer, Lights & Tabletop
const sceneSys = createSceneSystem(container);
const { renderer, scene, camera, bgScene, bgCamera, basketLight } = sceneSys;

// 2. Build Typewriter Chassis, Spools & Vibrator
const chassis = buildMachineChassis(scene);

// 3. Build 44 Keys, Special Keys, Spacebar & Linkage Rods
const keysSys = buildKeysSystem(chassis.machineRoot, chassis.materials);

// 4. Build Typebasket & 44 Chrome Typebars
const typebarsSys = buildTypebarsSystem(
  chassis.machineRoot,
  chassis.materials,
  keysSys.printableControllers
);

// 5. Build Carriage, Platen, Knobs & Return Lever
const carriageSys = buildCarriageSystem(
  chassis.machineRoot,
  chassis.materials,
  keysSys.clickableMeshes
);

// 6. Build Curved Paper Sheet & Letterpress Deboss Shader
const paperSys = createPaperSystem(carriageSys.carriageGroup);

// 7. Build SVG Telemetry HUD
const hudSys = createHudSystem(camera, carriageSys.carriageGroup);

// 8. Live Telemetry & Mechanical State
const telemetry = {
  col: 0,
  pageLine: 0,
  totalLinesTyped: 0,
  strikes: 0,
  lastKeyLabel: '[NONE]',
  shiftDown: false,
  marginLocked: false,
  ribbonColor: 'black', // 'black' | 'red'
  ribbonInk: 100.0,
  spoolAngle: 0.0,
  spoolDirection: 1,
  vibratorLiftY: 0,
  cameraShake: 0,
  lastStrikeTime: performance.now(),
  strikeIntervals: [175, 160, 185, 150, 170, 155, 145, 165, 150, 160],
  introDismissed: false
};

function dismissIntroPrompt() {
  if (telemetry.introDismissed) return;
  telemetry.introDismissed = true;
  const el = document.getElementById('intro-prompt');
  if (el) el.classList.add('hidden');
}

/**
 * Handles a printable character keystroke immediately so rapid typing (12+ keys/sec)
 * never drops a character, while launching the 3D key depression, typebar swing,
 * 60ms strike hold, slug flash, platen recoil, and carriage escapement step.
 */
function handlePrintableKey(ctrl, explicitChar = null) {
  sound.init();
  dismissIntroPrompt();

  // Depress 3D keycap with spring
  keysSys.depressKey(ctrl, 0.16);
  sound.playKeyClack(0.95 + Math.random() * 0.1);

  const charToPrint = explicitChar
    ? explicitChar
    : (telemetry.shiftDown ? ctrl.upper : ctrl.lower);

  telemetry.lastKeyLabel = `'${charToPrint}'`;

  // Check if carriage is locked at the right margin
  if (telemetry.col >= CONFIG.maxCols) {
    telemetry.marginLocked = true;
    typebarsSys.triggerBarSwing(ctrl, true, null);
    sound.playCarriageAdvanceClick(0.01);
    hudSys.triggerBellFlash();
    return;
  }

  // Record strike interval for HUD sparkline
  const now = performance.now();
  const dtMs = Math.min(500, Math.max(25, now - telemetry.lastStrikeTime));
  telemetry.lastStrikeTime = now;
  telemetry.strikeIntervals.push(dtMs);
  if (telemetry.strikeIntervals.length > 18) telemetry.strikeIntervals.shift();

  // Capture target column for this character immediately so zero keystrokes are ever lost
  const targetCol = telemetry.col;
  const targetLineId = telemetry.totalLinesTyped;
  const targetRibbon = telemetry.ribbonColor;

  // Stamp character onto paper canvas & advance carriage one char width left
  paperSys.stampCharacter(charToPrint, targetCol, 0, targetRibbon, targetLineId);

  telemetry.strikes++;
  telemetry.ribbonInk = Math.max(10.0, 100.0 - telemetry.strikes * 0.035);
  if (telemetry.strikes % 48 === 0) telemetry.spoolDirection *= -1;
  telemetry.spoolAngle += 0.09 * telemetry.spoolDirection;
  chassis.spoolGroupLeft.rotation.y = telemetry.spoolAngle;
  chassis.spoolGroupRight.rotation.y = telemetry.spoolAngle;

  // Advance column & translate carriage left so the struck character sits at world X = 0
  telemetry.col = Math.min(CONFIG.maxCols, telemetry.col + 1);
  carriageSys.advanceToCol(telemetry.col, -0.42);

  // Ring margin bell 8 characters before right margin
  if (telemetry.col === CONFIG.maxCols - CONFIG.bellOffset) {
    sound.playMarginBell();
    hudSys.triggerBellFlash();
  }
  if (telemetry.col >= CONFIG.maxCols) {
    telemetry.marginLocked = true;
  }

  // Trigger typebar swing + physical impact effects at strike apex
  typebarsSys.triggerBarSwing(ctrl, false, () => {
    carriageSys.triggerPlatenRecoil();
    telemetry.vibratorLiftY = telemetry.ribbonColor === 'red' ? 0.24 : 0.14;
    telemetry.cameraShake = 0.016;
    sound.playStrikeImpact();
  });
}

function handleSpace() {
  sound.init();
  dismissIntroPrompt();

  const sc = keysSys.keyMap.get('Space');
  keysSys.depressKey(sc, 0.14);
  telemetry.lastKeyLabel = 'SPACE';
  sound.playKeyClack(0.82);

  if (telemetry.col >= CONFIG.maxCols) {
    telemetry.marginLocked = true;
    hudSys.triggerBellFlash();
    return;
  }

  telemetry.col++;
  carriageSys.advanceToCol(telemetry.col, -0.34);
  sound.playCarriageAdvanceClick(0.02);

  if (telemetry.col === CONFIG.maxCols - CONFIG.bellOffset) {
    sound.playMarginBell();
    hudSys.triggerBellFlash();
  }
  if (telemetry.col >= CONFIG.maxCols) {
    telemetry.marginLocked = true;
  }
}

function handleBackspace() {
  sound.init();
  dismissIntroPrompt();

  const bc = keysSys.keyMap.get('Backspace');
  keysSys.depressKey(bc, 0.14);
  telemetry.lastKeyLabel = 'BACK';
  sound.playKeyClack(1.08);

  if (telemetry.col > 0) {
    telemetry.col--;
    telemetry.marginLocked = false;
    carriageSys.advanceToCol(telemetry.col, 0.34);
    sound.playCarriageAdvanceClick(0.02);
  }
}

function handleCarriageReturn() {
  sound.init();
  dismissIntroPrompt();

  const ec = keysSys.keyMap.get('Enter');
  keysSys.depressKey(ec, 0.15);
  telemetry.lastKeyLabel = 'CR / LF';

  const distanceRatio = Math.max(0.2, telemetry.col / CONFIG.maxCols);
  sound.playCarriageReturn(distanceRatio);

  telemetry.col = 0;
  telemetry.marginLocked = false;
  telemetry.pageLine++;
  telemetry.totalLinesTyped++;

  carriageSys.triggerCarriageReturnMotion();

  // If the page fills (28 lines), automatically feed a fresh sheet from behind the platen!
  if (telemetry.pageLine >= CONFIG.maxLinesPerPage) {
    telemetry.pageLine = 0;
    paperSys.triggerNewSheetInsert();
  } else {
    paperSys.rollCanvasTextUpOneLine();
    paperSys.triggerLineFeedWave();
  }
}

function handleShiftChange(mode) {
  const nextState = mode === 'toggle' ? !telemetry.shiftDown : Boolean(mode);
  if (telemetry.shiftDown === nextState) return;
  telemetry.shiftDown = nextState;

  typebarsSys.setBasketShift(nextState);
  const sl = keysSys.keyMap.get('ShiftLeft');
  const sr = keysSys.keyMap.get('ShiftRight');
  if (sl) sl.targetPress = nextState ? 0.14 : 0;
  if (sr) sr.targetPress = nextState ? 0.14 : 0;

  if (nextState) {
    sound.init();
    sound.playKeyClack(0.76);
  }
}

function handleToggleRibbonColor() {
  sound.init();
  const tc = keysSys.keyMap.get('Tab');
  keysSys.depressKey(tc, 0.14);
  sound.playKeyClack(1.12);

  telemetry.ribbonColor = telemetry.ribbonColor === 'black' ? 'red' : 'black';
  telemetry.lastKeyLabel = telemetry.ribbonColor === 'red' ? 'RIB: RED' : 'RIB: BLK';

  const btnRibbon = document.getElementById('btn-ribbon');
  if (btnRibbon) {
    btnRibbon.textContent = telemetry.ribbonColor === 'red' ? 'RIBBON: RED' : 'RIBBON: BLK';
    btnRibbon.classList.toggle('warn', telemetry.ribbonColor === 'red');
  }
}

// 9. Wire Input System & Top Bar Buttons
const inputSys = createInputSystem({
  rendererDom: renderer.domElement,
  camera,
  keyMap: keysSys.keyMap,
  charToKeyMap: keysSys.charToKeyMap,
  clickableMeshes: keysSys.clickableMeshes,
  onPrintableKey: handlePrintableKey,
  onSpace: handleSpace,
  onBackspace: handleBackspace,
  onCarriageReturn: handleCarriageReturn,
  onShiftChange: handleShiftChange,
  onToggleRibbonColor: handleToggleRibbonColor
});

document.getElementById('btn-return')?.addEventListener('click', () => handleCarriageReturn());
document.getElementById('btn-ribbon')?.addEventListener('click', () => handleToggleRibbonColor());
document.getElementById('btn-sheet')?.addEventListener('click', () => {
  sound.init();
  sound.playCarriageReturn(0.8);
  telemetry.col = 0;
  telemetry.pageLine = 0;
  telemetry.marginLocked = false;
  carriageSys.triggerCarriageReturnMotion();
  paperSys.triggerNewSheetInsert();
});

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
});

// 10. Main 60fps Animation & Render Loop
const clock = new THREE.Clock();
let elapsedTotal = 0;
const smoothPointer = new THREE.Vector2(0, 0);
const currentLookAt = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);

  // Process any queued keystrokes immediately at frame start
  inputSys.processQueue();

  const dt = Math.min(0.05, clock.getDelta());
  elapsedTotal += dt;

  sceneSys.bgUniforms.uTime.value = elapsedTotal;

  // Subtle idle breathing light inside the typebasket
  basketLight.intensity = 1.15 + Math.sin(elapsedTotal * 2.1) * 0.18;

  // Update mechanical subsystems
  keysSys.updateKeys(dt);
  typebarsSys.updateTypebars(dt, elapsedTotal);
  carriageSys.updateCarriage(dt);
  paperSys.updatePaper(dt, elapsedTotal);

  // Ribbon vibrator lift decay
  telemetry.vibratorLiftY *= Math.exp(-dt * 24.0);
  chassis.vibratorGroup.position.y = 3.10 + telemetry.vibratorLiftY;

  // Camera 2s ease-in intro push + bounding-box framing + pointer parallax + micro-shake
  const introProgress = Math.min(1.0, elapsedTotal / 2.0);
  const introEase = 1.0 - Math.pow(1.0 - introProgress, 3.0);

  smoothPointer.x += (inputSys.pointerNDC.x - smoothPointer.x) * Math.min(1.0, dt * 5.0);
  smoothPointer.y += (inputSys.pointerNDC.y - smoothPointer.y) * Math.min(1.0, dt * 5.0);

  const basePose = sceneSys.computeFittedCameraPose();
  const introOffset = (1.0 - introEase) * 2.2;
  const swayX = Math.sin(elapsedTotal * 0.60) * 0.06 + smoothPointer.x * 0.35;
  const swayY = Math.cos(elapsedTotal * 0.48) * 0.04 + smoothPointer.y * 0.20;

  telemetry.cameraShake *= Math.exp(-dt * 30.0);
  const shakeX = (Math.random() - 0.5) * telemetry.cameraShake;
  const shakeY = (Math.random() - 0.5) * telemetry.cameraShake;

  camera.position.set(
    basePose.pos.x + swayX + shakeX,
    basePose.pos.y + introOffset * 0.5 + swayY + shakeY,
    basePose.pos.z + introOffset
  );

  currentLookAt.copy(basePose.lookAt);
  currentLookAt.x += smoothPointer.x * 0.12;
  currentLookAt.y += smoothPointer.y * 0.08 + shakeY * 0.5;
  camera.lookAt(currentLookAt);

  // Update SVG Telemetry HUD
  hudSys.updateHud(telemetry);

  // Render Background + Main 3D Scene
  renderer.clear();
  renderer.render(bgScene, bgCamera);
  renderer.clearDepth();
  renderer.render(scene, camera);
}

animate();
