import * as THREE from 'three';
import { CONFIG } from './config.js';

/**
 * Builds a ribbed matte grey-white plastic Olivetti Lettera 32 platen knob
 */
function createRibbedKnob(knobPlasticMat, chromeMat, sideSign = 1) {
  const group = new THREE.Group();

  const mainCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.40, 0.40, 0.42, 28),
    knobPlasticMat
  );
  mainCyl.rotation.z = Math.PI / 2;
  mainCyl.castShadow = true;
  group.add(mainCyl);

  const ribGeo = new THREE.BoxGeometry(0.40, 0.030, 0.042);
  const numRibs = 18;
  for (let i = 0; i < numRibs; i++) {
    const angle = (i / numRibs) * Math.PI * 2;
    const rib = new THREE.Mesh(ribGeo, knobPlasticMat);
    rib.position.set(0, Math.cos(angle) * 0.395, Math.sin(angle) * 0.395);
    rib.rotation.x = -angle;
    group.add(rib);
  }

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20),
    chromeMat
  );
  cap.rotation.z = Math.PI / 2;
  cap.position.x = sideSign * 0.22;
  group.add(cap);

  return group;
}

/**
 * Builds the Olivetti Lettera 32 Carriage assembly:
 * - On desktop/landscape: full 46-column carriage travel (`0.185` world units/col)
 * - On portrait phones: keeps carriage centered within a compact travel range so the machine
 *   can fill ~96% of the phone screen width while keeping both ribbed knobs visible!
 */
export function buildCarriageSystem(machineRoot, materials, clickableMeshes) {
  const { enamelBodyMat, darkSteelMat, chromeMat, rubberMat, knobPlasticMat } = materials;

  const fixedRailGeo = new THREE.CylinderGeometry(0.055, 0.055, CONFIG.platenLength + 1.4, 16);
  fixedRailGeo.rotateZ(Math.PI / 2);
  const fixedRailMesh = new THREE.Mesh(fixedRailGeo, chromeMat);
  fixedRailMesh.position.set(0, 2.26, -1.25);
  machineRoot.add(fixedRailMesh);

  const carriageGroup = new THREE.Group();

  function computeCarriageXForCol(col) {
    const isPortrait = (window.innerWidth / Math.max(1, window.innerHeight)) < 0.92;
    const centerCol = (CONFIG.maxCols - 1) * 0.5; // 22.5
    if (isPortrait) {
      // On portrait phones, center carriage around the middle of the first words (col 10)
      // with a gentler travel step so both knobs stay inside the 96%-width portrait frame
      return THREE.MathUtils.clamp((10 - col) * 0.035, -0.45, 0.35);
    }
    return (centerCol - col) * CONFIG.charStepWorld;
  }

  const startX = computeCarriageXForCol(0);
  carriageGroup.position.set(startX, 2.84, -1.16);
  machineRoot.add(carriageGroup);

  // 1. Platen Roller Group
  const platenRollerGroup = new THREE.Group();
  carriageGroup.add(platenRollerGroup);

  const platenGeo = new THREE.CylinderGeometry(CONFIG.platenRadius, CONFIG.platenRadius, CONFIG.platenLength, 40);
  platenGeo.rotateZ(Math.PI / 2);
  const platenMesh = new THREE.Mesh(platenGeo, rubberMat);
  platenMesh.castShadow = true;
  platenMesh.receiveShadow = true;
  platenRollerGroup.add(platenMesh);

  const capGeo = new THREE.CylinderGeometry(CONFIG.platenRadius * 1.03, CONFIG.platenRadius * 1.03, 0.14, 32);
  capGeo.rotateZ(Math.PI / 2);
  const leftPlatenCap = new THREE.Mesh(capGeo, chromeMat);
  leftPlatenCap.position.x = -CONFIG.platenLength * 0.5 - 0.07;
  platenRollerGroup.add(leftPlatenCap);

  const rightPlatenCap = new THREE.Mesh(capGeo, chromeMat);
  rightPlatenCap.position.x = CONFIG.platenLength * 0.5 + 0.07;
  platenRollerGroup.add(rightPlatenCap);

  const axleGeo = new THREE.CylinderGeometry(0.085, 0.085, CONFIG.platenLength + 1.9, 16);
  axleGeo.rotateZ(Math.PI / 2);
  const axleMesh = new THREE.Mesh(axleGeo, chromeMat);
  platenRollerGroup.add(axleMesh);

  const leftKnob = createRibbedKnob(knobPlasticMat, chromeMat, -1);
  leftKnob.position.x = -CONFIG.platenLength * 0.5 - 0.82;
  platenRollerGroup.add(leftKnob);

  const rightKnob = createRibbedKnob(knobPlasticMat, chromeMat, 1);
  rightKnob.position.x = CONFIG.platenLength * 0.5 + 0.82;
  platenRollerGroup.add(rightKnob);

  // 2. Carriage End Plates, Angled Paper Table, Rear Margin Rail & Margin Stops
  const endPlateGeo = new THREE.BoxGeometry(0.22, 1.12, 1.50);
  const leftCarriagePlate = new THREE.Mesh(endPlateGeo, enamelBodyMat);
  leftCarriagePlate.position.set(-CONFIG.platenLength * 0.5 - 0.26, 0.08, -0.12);
  leftCarriagePlate.castShadow = true;
  carriageGroup.add(leftCarriagePlate);

  const rightCarriagePlate = new THREE.Mesh(endPlateGeo, enamelBodyMat);
  rightCarriagePlate.position.set(CONFIG.platenLength * 0.5 + 0.26, 0.08, -0.12);
  rightCarriagePlate.castShadow = true;
  carriageGroup.add(rightCarriagePlate);

  const paperTableGeo = new THREE.BoxGeometry(CONFIG.platenLength, 2.10, 0.08);
  const paperTableMesh = new THREE.Mesh(paperTableGeo, enamelBodyMat);
  paperTableMesh.position.set(0, 1.02, -0.86);
  paperTableMesh.rotation.x = -0.22;
  paperTableMesh.castShadow = true;
  paperTableMesh.receiveShadow = true;
  carriageGroup.add(paperTableMesh);

  const marginRail = new THREE.Mesh(new THREE.BoxGeometry(CONFIG.platenLength, 0.07, 0.09), chromeMat);
  marginRail.position.set(0, 1.46, -1.04);
  carriageGroup.add(marginRail);

  [-3.65, 3.65].forEach((mx) => {
    const stopSlider = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.16, 0.15), darkSteelMat);
    stopSlider.position.set(mx, 1.48, -1.04);
    carriageGroup.add(stopSlider);

    const stopPin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.11), chromeMat);
    stopPin.position.set(mx, 1.58, -1.04);
    carriageGroup.add(stopPin);
  });

  // 3. Matte Satin Paper Bail Bar with Two Small Rubber Rollers
  const bailMat = new THREE.MeshStandardMaterial({
    color: 0x9b968c,
    roughness: 0.68,
    metalness: 0.0,
    envMapIntensity: 0.15
  });
  const bailRodGeo = new THREE.CylinderGeometry(0.032, 0.032, CONFIG.platenLength, 16);
  bailRodGeo.rotateZ(Math.PI / 2);
  const bailRodMesh = new THREE.Mesh(bailRodGeo, bailMat);
  bailRodMesh.position.set(0, 0.22, 0.54);
  carriageGroup.add(bailRodMesh);

  [-2.35, 2.35].forEach((rx) => {
    const rGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.24, 16);
    rGeo.rotateZ(Math.PI / 2);
    const rMesh = new THREE.Mesh(rGeo, rubberMat);
    rMesh.position.set(rx, 0.22, 0.54);
    carriageGroup.add(rMesh);
  });

  // 4. Oxidized Satin-Nickel Carriage Return Lever on Left End
  const returnLeverGroup = new THREE.Group();
  returnLeverGroup.position.set(-CONFIG.platenLength * 0.5 - 0.20, 0.56, 0.12);
  carriageGroup.add(returnLeverGroup);

  const leverArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 1.68), chromeMat);
  leverArm.position.set(0, 0.14, 0.76);
  leverArm.rotation.x = 0.16;
  leverArm.castShadow = true;
  returnLeverGroup.add(leverArm);

  const leverPaddle = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.07, 0.40), chromeMat);
  leverPaddle.position.set(0.15, 0.02, 1.58);
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

  const state = {
    targetX: startX,
    velX: 0,
    platenTargetRotX: 0,
    platenCurrentRotX: 0,
    platenRecoilZ: 0,
    platenWobble: 0,
    returnLeverSwing: 0
  };

  function advanceToCol(col, overshootImpulse = -0.42) {
    state.targetX = computeCarriageXForCol(col);
    state.velX += overshootImpulse;
  }

  function triggerPlatenRecoil() {
    state.platenRecoilZ = -0.034;
  }

  function triggerCarriageReturnMotion(startCol = 0) {
    state.targetX = computeCarriageXForCol(startCol);
    state.velX += 1.50;
    state.returnLeverSwing = 0.54;
    state.platenTargetRotX -= 0.40;
    state.platenWobble = 0.055;
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
