import * as THREE from 'three';
import { CONFIG } from './config.js';

/**
 * Builds a ribbed grey-white plastic Olivetti Lettera 32 platen knob
 */
function createRibbedKnob(knobPlasticMat, chromeMat, sideSign = 1) {
  const group = new THREE.Group();

  const mainCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.44, 28),
    knobPlasticMat
  );
  mainCyl.rotation.z = Math.PI / 2;
  mainCyl.castShadow = true;
  group.add(mainCyl);

  // 18 physical ribs around the circumference of the plastic knob
  const ribGeo = new THREE.BoxGeometry(0.42, 0.032, 0.045);
  const numRibs = 18;
  for (let i = 0; i < numRibs; i++) {
    const angle = (i / numRibs) * Math.PI * 2;
    const rib = new THREE.Mesh(ribGeo, knobPlasticMat);
    rib.position.set(0, Math.cos(angle) * 0.415, Math.sin(angle) * 0.415);
    rib.rotation.x = -angle;
    group.add(rib);
  }

  // Satin metal center cap on outer face
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20),
    chromeMat
  );
  cap.rotation.z = Math.PI / 2;
  cap.position.x = sideSign * 0.23;
  group.add(cap);

  return group;
}

/**
 * Builds the Olivetti Lettera 32 Carriage assembly:
 * - Dark grey matte rubber platen (roughness 0.90)
 * - Two grey-white ribbed plastic platen knobs
 * - Thin carriage guide rail + graduated margin rail with two movable margin stops
 * - Paper bail rod with two small rubber rollers
 * - Left satin-nickel carriage return lever
 */
export function buildCarriageSystem(machineRoot, materials, clickableMeshes) {
  const { enamelBodyMat, darkSteelMat, chromeMat, rubberMat, knobPlasticMat } = materials;

  // Fixed thin carriage guide rail mounted to the chassis under the moving carriage
  const fixedRailGeo = new THREE.CylinderGeometry(0.06, 0.06, CONFIG.platenLength + 1.6, 16);
  fixedRailGeo.rotateZ(Math.PI / 2);
  const fixedRailMesh = new THREE.Mesh(fixedRailGeo, chromeMat);
  fixedRailMesh.position.set(0, 2.28, -1.25);
  machineRoot.add(fixedRailMesh);

  const carriageGroup = new THREE.Group();

  // Compute carriage X so that column `col` is centered at world X = 0
  // Supports both 46 columns (desktop) and 36 columns (portrait phone, centered on columns 5..40)
  function computeCarriageXForCol(col) {
    const centerCol = (CONFIG.maxCols - 1) * 0.5; // 22.5
    return (centerCol - col) * CONFIG.charStepWorld;
  }

  const startX = computeCarriageXForCol(0);
  carriageGroup.position.set(startX, 2.86, -1.16);
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

  // Satin Nickel Platen End Rings
  const capGeo = new THREE.CylinderGeometry(CONFIG.platenRadius * 1.03, CONFIG.platenRadius * 1.03, 0.14, 32);
  capGeo.rotateZ(Math.PI / 2);
  const leftPlatenCap = new THREE.Mesh(capGeo, chromeMat);
  leftPlatenCap.position.x = -CONFIG.platenLength * 0.5 - 0.07;
  platenRollerGroup.add(leftPlatenCap);

  const rightPlatenCap = new THREE.Mesh(capGeo, chromeMat);
  rightPlatenCap.position.x = CONFIG.platenLength * 0.5 + 0.07;
  platenRollerGroup.add(rightPlatenCap);

  // Central Axle & Two Grey-White Ribbed Plastic Knobs
  const axleGeo = new THREE.CylinderGeometry(0.09, 0.09, CONFIG.platenLength + 2.2, 16);
  axleGeo.rotateZ(Math.PI / 2);
  const axleMesh = new THREE.Mesh(axleGeo, chromeMat);
  platenRollerGroup.add(axleMesh);

  const leftKnob = createRibbedKnob(knobPlasticMat, chromeMat, -1);
  leftKnob.position.x = -CONFIG.platenLength * 0.5 - 0.92;
  platenRollerGroup.add(leftKnob);

  const rightKnob = createRibbedKnob(knobPlasticMat, chromeMat, 1);
  rightKnob.position.x = CONFIG.platenLength * 0.5 + 0.92;
  platenRollerGroup.add(rightKnob);

  // 2. Carriage End Plates, Angled Paper Table, Rear Margin Rail & Margin Stops
  const endPlateGeo = new THREE.BoxGeometry(0.22, 1.15, 1.55);
  const leftCarriagePlate = new THREE.Mesh(endPlateGeo, enamelBodyMat);
  leftCarriagePlate.position.set(-CONFIG.platenLength * 0.5 - 0.28, 0.08, -0.12);
  leftCarriagePlate.castShadow = true;
  carriageGroup.add(leftCarriagePlate);

  const rightCarriagePlate = new THREE.Mesh(endPlateGeo, enamelBodyMat);
  rightCarriagePlate.position.set(CONFIG.platenLength * 0.5 + 0.28, 0.08, -0.12);
  rightCarriagePlate.castShadow = true;
  carriageGroup.add(rightCarriagePlate);

  const paperTableGeo = new THREE.BoxGeometry(CONFIG.platenLength, 2.15, 0.08);
  const paperTableMesh = new THREE.Mesh(paperTableGeo, enamelBodyMat);
  paperTableMesh.position.set(0, 1.05, -0.86);
  paperTableMesh.rotation.x = -0.22;
  paperTableMesh.castShadow = true;
  paperTableMesh.receiveShadow = true;
  carriageGroup.add(paperTableMesh);

  // Thin Graduated Margin Stop Rail & Two Margin Stop Sliders
  const marginRail = new THREE.Mesh(new THREE.BoxGeometry(CONFIG.platenLength, 0.07, 0.09), chromeMat);
  marginRail.position.set(0, 1.48, -1.04);
  carriageGroup.add(marginRail);

  [-3.85, 3.85].forEach((mx) => {
    const stopSlider = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.16), darkSteelMat);
    stopSlider.position.set(mx, 1.50, -1.04);
    carriageGroup.add(stopSlider);

    const stopPin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.12), chromeMat);
    stopPin.position.set(mx, 1.60, -1.04);
    carriageGroup.add(stopPin);
  });

  // 3. Paper Bail Bar with Two Small Rubber Rollers
  const bailRodGeo = new THREE.CylinderGeometry(0.034, 0.034, CONFIG.platenLength, 16);
  bailRodGeo.rotateZ(Math.PI / 2);
  const bailRodMesh = new THREE.Mesh(bailRodGeo, chromeMat);
  bailRodMesh.position.set(0, 0.22, 0.55);
  carriageGroup.add(bailRodMesh);

  [-2.45, 2.45].forEach((rx) => {
    const rGeo = new THREE.CylinderGeometry(0.082, 0.082, 0.26, 16);
    rGeo.rotateZ(Math.PI / 2);
    const rMesh = new THREE.Mesh(rGeo, rubberMat);
    rMesh.position.set(rx, 0.22, 0.55);
    carriageGroup.add(rMesh);
  });

  // 4. Satin-Nickel Carriage Return Lever on Left End
  const returnLeverGroup = new THREE.Group();
  returnLeverGroup.position.set(-CONFIG.platenLength * 0.5 - 0.22, 0.58, 0.12);
  carriageGroup.add(returnLeverGroup);

  const leverArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 1.75), chromeMat);
  leverArm.position.set(0, 0.14, 0.80);
  leverArm.rotation.x = 0.16;
  leverArm.castShadow = true;
  returnLeverGroup.add(leverArm);

  const leverPaddle = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.42), chromeMat);
  leverPaddle.position.set(0.16, 0.02, 1.65);
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

  function advanceToCol(col, overshootImpulse = -0.45) {
    state.targetX = computeCarriageXForCol(col);
    state.velX += overshootImpulse;
  }

  function triggerPlatenRecoil() {
    state.platenRecoilZ = -0.036;
  }

  function triggerCarriageReturnMotion(startCol = 0) {
    state.targetX = computeCarriageXForCol(startCol);
    state.velX += 1.55;
    state.returnLeverSwing = 0.56;
    state.platenTargetRotX -= 0.40;
    state.platenWobble = 0.06;
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
