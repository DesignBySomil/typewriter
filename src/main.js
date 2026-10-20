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

// 1. Initialize Scene, Camera, Renderer, RoomEnvironment & Tabletop
const sceneSys = createSceneSystem(container);
const { renderer, scene, camera, bgScene, bgCamera, basketLight } = sceneSys;

// 2. Build 1963 Olivetti Lettera 32 Chassis, Covered Spools & Vibrator
const chassis = buildMachineChassis(scene);

// 3. Build 44 Staggered Keys, Wide Shift Keys, Matte Spacebar & Linkage Rods
const keysSys = buildKeysSystem(chassis.machineRoot, chassis.materials);

// 4. Build Typebasket, 44 Dull Steel Typebars with Oxidised Slugs & Ink-Dust Emitter
const typebarsSys = buildTypebarsSystem(
  chassis.machineRoot,
  chassis.materials,
  keysSys.printableControllers
);

// 5. Build Carriage, Matte Rubber Platen, Ribbed Plastic Knobs & Return Lever
const carriageSys = buildCarriageSystem(
  chassis.machineRoot,
  chassis.materials,
  keysSys.clickableMeshes
);

// 6. Build 80gsm Bond Paper Sheet & Letterpress Deboss Shader
const paperSys = createPaperSystem(carriageSys.carriageGroup);

// 7. Build SVG Telemetry HUD
const hudSys = createHudSystem(camera, carriageSys.carriageGroup);

/**
 * Returns active column bounds:
 * - Desktop / Landscape: 46 columns (0..46)
 * - Portrait Phones: 36 columns centered on the sheet (cols 5..41) so both platen knobs stay in frame
 */
function getActiveColumnBounds() {
  const isPortrait = (window.innerWidth / Math.max(1, window.innerHeight)) < 0.92;
  if (isPortrait) {
    const pad = Math.floor((CONFIG.maxCols - CONFIG.portraitCols) * 0.5); // 5
    return {
      minCol: pad,
      maxCol: pad + CONFIG.portraitCols,
      totalCols: CONFIG.portraitCols
    };
  }
  return {
    minCol: 0,
    maxCol: CONFIG.maxCols,
    totalCols: CONFIG.maxCols
  };
}

const initialBounds = getActiveColumnBounds();

// 8. Live Telemetry & Mechanical State
const telemetry = {
  col: initialBounds.minCol,
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

function handlePrintableKey(ctrl, explicitChar = null) {
  sound.init();
  dismissIntroPrompt();

  const bounds = getActiveColumnBounds();
  if (telemetry.col < bounds.minCol) telemetry.col = bounds.minCol;

  // Deep 3-4px equivalent key sink + neighbor ripple
  keysSys.depressKey(ctrl, 0.34);
  sound.playKeyClack(0.95 + Math.random() * 0.1);

  const charToPrint = explicitChar
    ? explicitChar
    : (telemetry.shiftDown ? ctrl.upper : ctrl.lower);

  telemetry.lastKeyLabel = `'${charToPrint}'`;

  // Check if carriage is locked at the active right margin
  if (telemetry.col >= bounds.maxCol) {
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

  const targetCol = telemetry.col;
  const targetLineId = telemetry.totalLinesTyped;
  const targetRibbon = telemetry.ribbonColor;

  // Stamp character onto 80gsm bond paper canvas & advance carriage one char width left
  paperSys.stampCharacter(charToPrint, targetCol, 0, targetRibbon, targetLineId);

  telemetry.strikes++;
  telemetry.ribbonInk = Math.max(10.0, 100.0 - telemetry.strikes * 0.035);
  if (telemetry.strikes % 46 === 0) telemetry.spoolDirection *= -1;
  telemetry.spoolAngle += 0.095 * telemetry.spoolDirection;
  chassis.spoolGroupLeft.rotation.y = telemetry.spoolAngle;
  chassis.spoolGroupRight.rotation.y = telemetry.spoolAngle;

  // Advance column & translate carriage left so the struck character sits at world X = 0
  telemetry.col = Math.min(bounds.maxCol, telemetry.col + 1);
  carriageSys.advanceToCol(telemetry.col, -0.45);

  // Ring margin bell 8 characters before active right margin
  if (telemetry.col === bounds.maxCol - CONFIG.bellOffset) {
    sound.playMarginBell();
    hudSys.triggerBellFlash();
  }
  if (telemetry.col >= bounds.maxCol) {
    telemetry.marginLocked = true;
  }

  // Trigger typebar swing + physical impact effects at strike apex
  typebarsSys.triggerBarSwing(ctrl, false, () => {
    carriageSys.triggerPlatenRecoil();
    typebarsSys.triggerInkDustPuff(targetRibbon);
    telemetry.vibratorLiftY = targetRibbon === 'red' ? 0.22 : 0.13;
    telemetry.cameraShake = 0.012;
    telemetry.cameraNudgeY = -0.020; // Crisp ~1px vertical camera nudge at impact
    sound.playStrikeImpact();
  });
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
  carriageSys.advanceToCol(telemetry.col, -0.36);
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
    carriageSys.advanceToCol(telemetry.col, 0.36);
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
  telemetry.pageLine++;
  telemetry.totalLinesTyped++;

  carriageSys.triggerCarriageReturnMotion(bounds.minCol);

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
  if (sl) sl.targetPress = nextState ? 0.24 : 0;
  if (sr) sr.targetPress = nextState ? 0.24 : 0;

  if (nextState) {
    sound.init();
    sound.playKeyClack(0.76);
  }
}

function handleToggleRibbonColor() {
  sound.init();
  const tc = keysSys.keyMap.get('Tab');
  keysSys.depressKey(tc, 0.28);
  sound.playKeyClack(1.12);

  telemetry.ribbonColor = telemetry.ribbonColor === 'black' ? 'red' : 'black';
  telemetry.lastKeyLabel = telemetry.ribbonColor === 'red' ? 'RIB: RED' : 'RIB: BLK';

  const btnRibbon = document.getElementById('btn-ribbon');
  if (btnRibbon) {
    btnRibbon.textContent = telemetry.ribbonColor === 'red' ? 'RIBBON: RED' : 'RIBBON: BLK';
    btnRibbon.classList.toggle('warn', telemetry.ribbonColor === 'red');
  }
}

function handleToggleHudVisibility() {
  document.body.classList.toggle('hud-hidden');
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
  onToggleRibbonColor: handleToggleRibbonColor,
  onToggleHudVisibility: handleToggleHudVisibility
});

document.getElementById('btn-return')?.addEventListener('click', () => handleCarriageReturn());
document.getElementById('btn-ribbon')?.addEventListener('click', () => handleToggleRibbonColor());
document.getElementById('btn-sheet')?.addEventListener('click', () => {
  sound.init();
  const bounds = getActiveColumnBounds();
  sound.playCarriageReturn(0.8);
  telemetry.col = bounds.minCol;
  telemetry.pageLine = 0;
  telemetry.marginLocked = false;
  carriageSys.triggerCarriageReturnMotion(bounds.minCol);
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
  const b = getActiveColumnBounds();
  if (telemetry.col < b.minCol) {
    telemetry.col = b.minCol;
    carriageSys.advanceToCol(telemetry.col, 0);
  }
});

// 10. Main 60fps Animation & Render Loop
const clock = new THREE.Clock();
let elapsedTotal = 0;
const smoothPointer = new THREE.Vector2(0, 0);
const currentLookAt = new THREE.Vector3();
const camOffsetVec = new THREE.Vector3();
const spherical = new THREE.Spherical();

function animate() {
  requestAnimationFrame(animate);

  // Process any queued keystrokes immediately at frame start
  inputSys.processQueue();

  const dt = Math.min(0.05, clock.getDelta());
  elapsedTotal += dt;

  sceneSys.bgUniforms.uTime.value = elapsedTotal;

  // Subtle warm studio light inside the typebasket
  basketLight.intensity = 0.55 + Math.sin(elapsedTotal * 1.8) * 0.06;

  // Update mechanical subsystems
  keysSys.updateKeys(dt);
  typebarsSys.updateTypebars(dt);
  carriageSys.updateCarriage(dt);
  paperSys.updatePaper(dt, elapsedTotal);

  // Ribbon vibrator lift decay
  telemetry.vibratorLiftY *= Math.exp(-dt * 24.0);
  chassis.vibratorGroup.position.y = 2.66 + telemetry.vibratorLiftY;

  // Camera 2s ease-in intro push + ~3-degree pointer parallax + subtle idle drift
  const introProgress = Math.min(1.0, elapsedTotal / 2.0);
  const introEase = 1.0 - Math.pow(1.0 - introProgress, 3.0);

  smoothPointer.x += (inputSys.pointerNDC.x - smoothPointer.x) * Math.min(1.0, dt * 5.0);
  smoothPointer.y += (inputSys.pointerNDC.y - smoothPointer.y) * Math.min(1.0, dt * 5.0);

  const basePose = sceneSys.computeFittedCameraPose();
  const introPush = (1.0 - introEase) * 1.5;

  camOffsetVec.copy(basePose.pos).sub(basePose.lookAt);
  spherical.setFromVector3(camOffsetVec);

  const maxParallaxRad = THREE.MathUtils.degToRad(3.0);
  const idleDriftAzimuth = Math.sin(elapsedTotal * 0.50) * 0.006;
  const idleDriftPolar   = Math.cos(elapsedTotal * 0.38) * 0.005;

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
  currentLookAt.x += smoothPointer.x * 0.11;
  currentLookAt.y += smoothPointer.y * 0.07 + shakeY * 0.65;
  camera.lookAt(currentLookAt);

  // Update SVG Telemetry HUD
  hudSys.updateHud(telemetry, getActiveColumnBounds());

  // Render Background + Main 3D Scene
  renderer.clear();
  renderer.render(bgScene, bgCamera);
  renderer.clearDepth();
  renderer.render(scene, camera);
}

animate();
