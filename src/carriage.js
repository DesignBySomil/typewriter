import * as THREE from 'three';
import { CONFIG } from './config.js';

function createRibbedKnob(knobPlasticMat, chromeMat, darkSteelMat, sideSign = 1) {
  const group = new THREE.Group();

  const mainCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.40, 0.40, 0.42, 28),
    knobPlasticMat
  );
  mainCyl.rotation.z = Math.PI / 2;
  mainCyl.castShadow = true;
  group.add(mainCyl);

  const ribGeo = new THREE.BoxGeometry(0.42, 0.038, 0.052);
  const numRibs = 18;
  for (let i = 0; i < numRibs; i++) {
    const angle = (i / numRibs) * Math.PI * 2;
    const mat = i % 3 === 0 ? darkSteelMat : knobPlasticMat;
    const rib = new THREE.Mesh(ribGeo, mat);
    rib.position.set(0, Math.cos(angle) * 0.402, Math.sin(angle) * 0.402);
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

  const indexPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.06, 12),
    darkSteelMat
  );
  indexPin.rotation.z = Math.PI / 2;
  indexPin.position.set(sideSign * 0.23, 0.13, 0.09);
  group.add(indexPin);

  return group;
}

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
    const centerCol = (CONFIG.maxCols - 1) * 0.5;
    if (isPortrait) {
      return THREE.MathUtils.clamp((10 - col) * 0.025, -0.28, 0.24);
    }
    return (centerCol - col) * CONFIG.charStepWorld;
  }

  function colToLocalPaperX(col) {
    const centerCol = (CONFIG.maxCols - 1) * 0.5;
    return (col - centerCol) * CONFIG.charStepWorld;
  }

  function localPaperXToCol(localX) {
    const centerCol = (CONFIG.maxCols - 1) * 0.5;
    const rawCol = Math.round(localX / CONFIG.charStepWorld + centerCol);
    return THREE.MathUtils.clamp(rawCol, 0, CONFIG.maxCols);
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

  // Subtle longitudinal witness grooves along the platen & end caps so 1:1 roller rotation is visibly unmistakable
  const grooveGeo = new THREE.BoxGeometry(CONFIG.platenLength + 0.28, 0.018, 0.024);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const groove = new THREE.Mesh(grooveGeo, i % 3 === 0 ? chromeMat : darkSteelMat);
    const r = CONFIG.platenRadius + 0.004;
    groove.position.set(0, Math.cos(ang) * r, Math.sin(ang) * r);
    groove.rotation.x = -ang;
    platenRollerGroup.add(groove);
  }

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

  const leftKnob = createRibbedKnob(knobPlasticMat, chromeMat, darkSteelMat, -1);
  leftKnob.position.x = -CONFIG.platenLength * 0.5 - 0.82;
  platenRollerGroup.add(leftKnob);

  const rightKnob = createRibbedKnob(knobPlasticMat, chromeMat, darkSteelMat, 1);
  rightKnob.position.x = CONFIG.platenLength * 0.5 + 0.82;
  platenRollerGroup.add(rightKnob);

  // 2. Carriage End Plates, Angled Paper Table, Rear Margin Rail & Draggable Margin Stops
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

  function createMarginStopGroup(initialX) {
    const g = new THREE.Group();
    g.position.set(initialX, 1.48, -1.04);

    const slider = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.16), darkSteelMat);
    g.add(slider);

    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.13), chromeMat);
    pin.position.y = 0.12;
    g.add(pin);

    const redTip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xc8382b })
    );
    redTip.position.y = 0.20;
    g.add(redTip);

    return g;
  }

  const leftMarginStopGroup = createMarginStopGroup(colToLocalPaperX(0));
  carriageGroup.add(leftMarginStopGroup);

  const rightMarginStopGroup = createMarginStopGroup(colToLocalPaperX(CONFIG.maxCols));
  carriageGroup.add(rightMarginStopGroup);

  // 2B. Paper Release Lever on Right Side of Carriage
  const paperReleaseLeverGroup = new THREE.Group();
  paperReleaseLeverGroup.position.set(CONFIG.platenLength * 0.5 + 0.16, 0.56, 0.08);
  carriageGroup.add(paperReleaseLeverGroup);

  const prArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.12), chromeMat);
  prArm.position.set(0, 0.16, 0.05);
  prArm.rotation.x = 0.25;
  paperReleaseLeverGroup.add(prArm);

  const prTip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 14), darkSteelMat);
  prTip.rotation.z = Math.PI / 2;
  prTip.position.set(0, 0.34, 0.12);
  paperReleaseLeverGroup.add(prTip);

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

  const state = {
    targetX: startX,
    velX: 0,
    platenTargetRotX: 0,
    platenCurrentRotX: 0,
    platenRotVelX: 0,
    platenRecoilZ: 0,
    returnLeverSwing: 0,
    returnLeverDragSwing: 0,
    paperReleased: false,
    paperReleaseTargetRotX: 0
  };

  function advanceToCol(col, overshootImpulse = -0.42) {
    state.targetX = computeCarriageXForCol(col);
    state.velX += overshootImpulse;
  }

  function setCarriageColContinuous(fractionalCol) {
    const x = computeCarriageXForCol(fractionalCol);
    state.targetX = x;
    state.velX = 0;
    carriageGroup.position.x = x;
  }

  function triggerPlatenRecoil() {
    state.platenRecoilZ = -0.034;
  }

  function rotatePlatenByLines(deltaLines, immediate = false) {
    const dAngle = -deltaLines * 0.62;
    state.platenTargetRotX += dAngle;
    if (immediate) {
      state.platenCurrentRotX += dAngle;
      state.platenRotVelX = 0;
      platenRollerGroup.rotation.x = state.platenCurrentRotX;
    } else {
      state.platenRotVelX -= Math.sign(deltaLines) * 1.4;
    }
  }

  function triggerCarriageReturnMotion(startCol = 0) {
    state.targetX = computeCarriageXForCol(startCol);
    state.velX += 1.50;
    state.returnLeverSwing = Math.max(state.returnLeverSwing, 0.58);
    state.platenTargetRotX -= 0.62;
    state.platenRotVelX -= 2.4;
  }

  function setMarginStopPositions(leftCol, rightCol) {
    leftMarginStopGroup.position.x = colToLocalPaperX(leftCol);
    rightMarginStopGroup.position.x = colToLocalPaperX(rightCol);
  }

  function setPaperReleased(released) {
    state.paperReleased = Boolean(released);
    state.paperReleaseTargetRotX = state.paperReleased ? 0.55 : 0.0;
  }

  function updateCarriage(dt) {
    const stiffness = 195.0;
    const damping = 17.5;
    const forceX = (state.targetX - carriageGroup.position.x) * stiffness;
    state.velX = (state.velX + forceX * dt) * Math.exp(-damping * dt);
    carriageGroup.position.x += state.velX * dt;

    const rotForce = (state.platenTargetRotX - state.platenCurrentRotX) * 180.0;
    state.platenRotVelX = (state.platenRotVelX + rotForce * dt) * Math.exp(-13.5 * dt);
    state.platenCurrentRotX += state.platenRotVelX * dt;
    platenRollerGroup.rotation.x = state.platenCurrentRotX;

    state.platenRecoilZ += (0.0 - state.platenRecoilZ) * Math.min(1.0, dt * 28.0);
    platenRollerGroup.position.z = state.platenRecoilZ;

    state.returnLeverSwing *= Math.exp(-dt * 9.5);
    returnLeverGroup.rotation.y = Math.max(state.returnLeverSwing, state.returnLeverDragSwing);

    paperReleaseLeverGroup.rotation.x += (state.paperReleaseTargetRotX - paperReleaseLeverGroup.rotation.x) * Math.min(1.0, dt * 16.0);
    bailRodMesh.position.z = state.paperReleased ? 0.61 : 0.54;
  }

  return {
    carriageGroup,
    platenRollerGroup,
    platenMesh,
    paperTableMesh,
    leftCarriagePlate,
    rightCarriagePlate,
    leftKnob,
    rightKnob,
    returnLeverGroup,
    leftMarginStopGroup,
    rightMarginStopGroup,
    paperReleaseLeverGroup,
    state,
    computeCarriageXForCol,
    colToLocalPaperX,
    localPaperXToCol,
    advanceToCol,
    setCarriageColContinuous,
    triggerPlatenRecoil,
    rotatePlatenByLines,
    triggerCarriageReturnMotion,
    setMarginStopPositions,
    setPaperReleased,
    updateCarriage
  };
}
