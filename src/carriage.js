import * as THREE from 'three';
import { CONFIG } from './config.js';

/**
 * Builds the moving Carriage assembly (rubber platen cylinder, dual knurled knobs,
 * rear paper support table, graduated paper bail bar, and clickable left carriage return lever)
 * and manages 1:1 horizontal escapement translation for the 46-column hero sheet.
 */
export function buildCarriageSystem(machineRoot, materials, clickableMeshes) {
  const { enamelBodyMat, darkSteelMat, chromeMat, rubberMat } = materials;

  const carriageGroup = new THREE.Group();

  // For 46 columns (0..45), column 0 sits at local paper X = `-22.5 * charStepWorld`.
  // Placing carriageGroup at `+22.5 * charStepWorld` puts column 0 dead-center at world X = 0!
  function computeCarriageXForCol(col) {
    const centerCol = (CONFIG.maxCols - 1) * 0.5; // 22.5
    return (centerCol - col) * CONFIG.charStepWorld;
  }

  const startX = computeCarriageXForCol(0);
  carriageGroup.position.set(startX, 3.18, -1.20);
  machineRoot.add(carriageGroup);

  // 1. Platen Roller Group (rotates on line feed, recoils on strike)
  const platenRollerGroup = new THREE.Group();
  carriageGroup.add(platenRollerGroup);

  const platenGeo = new THREE.CylinderGeometry(CONFIG.platenRadius, CONFIG.platenRadius, CONFIG.platenLength, 40);
  platenGeo.rotateZ(Math.PI / 2);
  const platenMesh = new THREE.Mesh(platenGeo, rubberMat);
  platenMesh.castShadow = true;
  platenMesh.receiveShadow = true;
  platenRollerGroup.add(platenMesh);

  // Chrome End Caps
  const capGeo = new THREE.CylinderGeometry(CONFIG.platenRadius * 1.03, CONFIG.platenRadius * 1.03, 0.18, 32);
  capGeo.rotateZ(Math.PI / 2);
  const leftPlatenCap = new THREE.Mesh(capGeo, chromeMat);
  leftPlatenCap.position.x = -CONFIG.platenLength * 0.5 - 0.08;
  platenRollerGroup.add(leftPlatenCap);

  const rightPlatenCap = new THREE.Mesh(capGeo, chromeMat);
  rightPlatenCap.position.x = CONFIG.platenLength * 0.5 + 0.08;
  platenRollerGroup.add(rightPlatenCap);

  // Central Axle & Dual Knobs
  const axleGeo = new THREE.CylinderGeometry(0.11, 0.11, CONFIG.platenLength + 2.4, 16);
  axleGeo.rotateZ(Math.PI / 2);
  const axleMesh = new THREE.Mesh(axleGeo, chromeMat);
  platenRollerGroup.add(axleMesh);

  const knobGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.42, 24);
  knobGeo.rotateZ(Math.PI / 2);
  const leftKnob = new THREE.Mesh(knobGeo, darkSteelMat);
  leftKnob.position.x = -CONFIG.platenLength * 0.5 - 1.05;
  leftKnob.castShadow = true;
  platenRollerGroup.add(leftKnob);

  const rightKnob = new THREE.Mesh(knobGeo, darkSteelMat);
  rightKnob.position.x = CONFIG.platenLength * 0.5 + 1.05;
  rightKnob.castShadow = true;
  platenRollerGroup.add(rightKnob);

  // 2. Carriage End Plates & Angled Rear Paper Support Table
  const endPlateGeo = new THREE.BoxGeometry(0.24, 1.35, 1.75);
  const leftCarriagePlate = new THREE.Mesh(endPlateGeo, enamelBodyMat);
  leftCarriagePlate.position.set(-CONFIG.platenLength * 0.5 - 0.32, 0.12, -0.15);
  leftCarriagePlate.castShadow = true;
  carriageGroup.add(leftCarriagePlate);

  const rightCarriagePlate = new THREE.Mesh(endPlateGeo, enamelBodyMat);
  rightCarriagePlate.position.set(CONFIG.platenLength * 0.5 + 0.32, 0.12, -0.15);
  rightCarriagePlate.castShadow = true;
  carriageGroup.add(rightCarriagePlate);

  const paperTableGeo = new THREE.BoxGeometry(CONFIG.platenLength, 2.75, 0.10);
  const paperTableMesh = new THREE.Mesh(paperTableGeo, enamelBodyMat);
  paperTableMesh.position.set(0, 1.32, -0.92);
  paperTableMesh.rotation.x = -0.22;
  paperTableMesh.castShadow = true;
  paperTableMesh.receiveShadow = true;
  carriageGroup.add(paperTableMesh);

  // 3. Chrome Paper Bail Rod & Rollers (positioned snugly so the typed line sits clearly above it)
  const bailRodGeo = new THREE.CylinderGeometry(0.038, 0.038, CONFIG.platenLength, 16);
  bailRodGeo.rotateZ(Math.PI / 2);
  const bailRodMesh = new THREE.Mesh(bailRodGeo, chromeMat);
  bailRodMesh.position.set(0, 0.24, 0.60);
  carriageGroup.add(bailRodMesh);

  [-2.9, 0, 2.9].forEach((rx) => {
    const rGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.24, 16);
    rGeo.rotateZ(Math.PI / 2);
    const rMesh = new THREE.Mesh(rGeo, rubberMat);
    rMesh.position.set(rx, 0.24, 0.60);
    carriageGroup.add(rMesh);
  });

  // 4. Chrome Carriage Return Lever on Left End
  const returnLeverGroup = new THREE.Group();
  returnLeverGroup.position.set(-CONFIG.platenLength * 0.5 - 0.25, 0.68, 0.15);
  carriageGroup.add(returnLeverGroup);

  const leverArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 1.85), chromeMat);
  leverArm.position.set(0, 0.15, 0.85);
  leverArm.rotation.x = 0.18;
  leverArm.castShadow = true;
  returnLeverGroup.add(leverArm);

  const leverPaddle = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.45), chromeMat);
  leverPaddle.position.set(0.18, 0.02, 1.75);
  leverPaddle.rotation.y = 0.35;
  leverPaddle.castShadow = true;
  returnLeverGroup.add(leverPaddle);

  const crLeverController = {
    code: 'Enter',
    label: 'RETURN LEVER',
    isSpecial: true
  };
  leverArm.userData.keyController = crLeverController;
  leverPaddle.userData.keyController = crLeverController;
  clickableMeshes.push(leverArm, leverPaddle);

  // Physics & Escapement State
  const state = {
    targetX: startX,
    velX: 0,
    platenTargetRotX: 0,
    platenCurrentRotX: 0,
    platenRecoilZ: 0,
    platenWobble: 0,
    returnLeverSwing: 0
  };

  function advanceToCol(col, overshootImpulse = -0.48) {
    state.targetX = computeCarriageXForCol(col);
    state.velX += overshootImpulse;
  }

  function triggerPlatenRecoil() {
    state.platenRecoilZ = -0.038;
  }

  function triggerCarriageReturnMotion() {
    state.targetX = computeCarriageXForCol(0);
    state.velX += 1.65;
    state.returnLeverSwing = 0.58;
    state.platenTargetRotX -= 0.42;
    state.platenWobble = 0.065;
  }

  function updateCarriage(dt) {
    const stiffness = 195.0;
    const damping = 17.5;
    const forceX = (state.targetX - carriageGroup.position.x) * stiffness;
    state.velX = (state.velX + forceX * dt) * Math.exp(-damping * dt);
    carriageGroup.position.x += state.velX * dt;

    state.platenCurrentRotX += (state.platenTargetRotX - state.platenCurrentRotX) * Math.min(1.0, dt * 15.0);
    state.platenWobble *= Math.exp(-dt * 12.0);
    platenRollerGroup.rotation.x = state.platenCurrentRotX + Math.sin(performance.now() * 0.05) * state.platenWobble;

    state.platenRecoilZ += (0.0 - state.platenRecoilZ) * Math.min(1.0, dt * 28.0);
    platenRollerGroup.position.z = state.platenRecoilZ;

    state.returnLeverSwing *= Math.exp(-dt * 9.5);
    returnLeverGroup.rotation.y = state.returnLeverSwing;
  }

  return {
    carriageGroup,
    platenRollerGroup,
    returnLeverGroup,
    state,
    computeCarriageXForCol,
    advanceToCol,
    triggerPlatenRecoil,
    triggerCarriageReturnMotion,
    updateCarriage
  };
}
