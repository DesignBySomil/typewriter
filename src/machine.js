import * as THREE from 'three';
import { createEnamelMaterial, createChromeMaterial } from './shaders/enamel.js';

export function buildMachineChassis(scene) {
  const machineRoot = new THREE.Group();
  scene.add(machineRoot);

  // Shared procedural materials
  const enamelBodyMat = createEnamelMaterial({
    baseColor: 0x10241b,
    fresnelTint: 0x549a7f,
    roughness: 0.25,
    metalness: 0.22,
    clearcoatBoost: 1.3
  });

  const darkSteelMat = createEnamelMaterial({
    baseColor: 0x202426,
    fresnelTint: 0x798d99,
    roughness: 0.30,
    metalness: 0.38,
    clearcoatBoost: 0.9
  });

  const chromeMat = createChromeMaterial();

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x1c1e20,
    roughness: 0.72,
    metalness: 0.06
  });

  // 1. Four Grippy Rubber Feet
  const footGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.24, 20);
  [
    [-4.6, 0.12, -2.5],
    [ 4.6, 0.12, -2.5],
    [-4.6, 0.12,  3.9],
    [ 4.6, 0.12,  3.9]
  ].forEach(([fx, fy, fz]) => {
    const foot = new THREE.Mesh(footGeo, rubberMat);
    foot.position.set(fx, fy, fz);
    foot.castShadow = true;
    foot.receiveShadow = true;
    machineRoot.add(foot);
  });

  // 2. Sculpted Vintage Olivetti/Underwood Side Walls
  const sideWallShape = new THREE.Shape();
  sideWallShape.moveTo(-3.2, 0.22);
  sideWallShape.lineTo(4.55, 0.22);
  sideWallShape.quadraticCurveTo(4.90, 0.22, 4.78, 0.68);
  sideWallShape.lineTo(2.4, 1.95);
  sideWallShape.quadraticCurveTo(1.6, 2.35, 0.6, 2.45);
  sideWallShape.lineTo(-0.5, 3.25);
  sideWallShape.quadraticCurveTo(-1.1, 3.55, -2.7, 3.50);
  sideWallShape.lineTo(-3.2, 2.65);
  sideWallShape.closePath();

  const sideWallGeo = new THREE.ExtrudeGeometry(sideWallShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.08,
    bevelThickness: 0.08
  });
  sideWallGeo.rotateY(Math.PI / 2);

  const leftWall = new THREE.Mesh(sideWallGeo, enamelBodyMat);
  leftWall.position.set(-5.15, 0, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  machineRoot.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, enamelBodyMat);
  rightWall.position.set(4.73, 0, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  machineRoot.add(rightWall);

  // 3. Lower Chassis Pan, Rear Housing & Front Chin Bar
  const basePan = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.35, 7.2), darkSteelMat);
  basePan.position.set(0, 0.38, 0.65);
  basePan.castShadow = true;
  basePan.receiveShadow = true;
  machineRoot.add(basePan);

  const rearHousing = new THREE.Mesh(new THREE.BoxGeometry(9.9, 2.95, 2.1), enamelBodyMat);
  rearHousing.position.set(0, 1.82, -2.15);
  rearHousing.castShadow = true;
  rearHousing.receiveShadow = true;
  machineRoot.add(rearHousing);

  const frontChinBar = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.48, 0.56), enamelBodyMat);
  frontChinBar.position.set(0, 0.45, 4.58);
  frontChinBar.castShadow = true;
  frontChinBar.receiveShadow = true;
  machineRoot.add(frontChinBar);

  // 4. Sculpted Top Hood Wings (Exposing the central Typebasket & Ribbon Spools)
  const hoodLeft = new THREE.Mesh(new THREE.BoxGeometry(2.50, 0.42, 2.8), enamelBodyMat);
  hoodLeft.position.set(-3.68, 2.28, 0.72);
  hoodLeft.rotation.x = 0.22;
  hoodLeft.castShadow = true;
  hoodLeft.receiveShadow = true;
  machineRoot.add(hoodLeft);

  const hoodRight = new THREE.Mesh(new THREE.BoxGeometry(2.50, 0.42, 2.8), enamelBodyMat);
  hoodRight.position.set(3.68, 2.28, 0.72);
  hoodRight.rotation.x = 0.22;
  hoodRight.castShadow = true;
  hoodRight.receiveShadow = true;
  machineRoot.add(hoodRight);

  const hoodFrontLip = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.30, 0.48), enamelBodyMat);
  hoodFrontLip.position.set(0, 1.96, 1.90);
  hoodFrontLip.rotation.x = 0.25;
  hoodFrontLip.castShadow = true;
  hoodFrontLip.receiveShadow = true;
  machineRoot.add(hoodFrontLip);

  // 5. Chrome Trim Strips
  const trimFront = new THREE.Mesh(new THREE.BoxGeometry(10.14, 0.10, 0.13), chromeMat);
  trimFront.position.set(0, 0.63, 4.86);
  machineRoot.add(trimFront);

  const trimHood = new THREE.Mesh(new THREE.BoxGeometry(10.14, 0.08, 0.12), chromeMat);
  trimHood.position.set(0, 2.09, 2.13);
  machineRoot.add(trimHood);

  // 6. Dual Exposed Bichrome Ribbon Spools (Left & Right)
  const spoolGroupLeft = new THREE.Group();
  spoolGroupLeft.position.set(-3.35, 2.52, 0.45);
  machineRoot.add(spoolGroupLeft);

  const spoolGroupRight = new THREE.Group();
  spoolGroupRight.position.set(3.35, 2.52, 0.45);
  machineRoot.add(spoolGroupRight);

  function populateSpool(targetGroup) {
    const flangeGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.04, 28);
    const coreGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.26, 24);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x151518, roughness: 0.85 });

    const bottomFlange = new THREE.Mesh(flangeGeo, chromeMat);
    bottomFlange.position.y = -0.13;
    targetGroup.add(bottomFlange);

    const topFlange = new THREE.Mesh(flangeGeo, chromeMat);
    topFlange.position.y = 0.13;
    targetGroup.add(topFlange);

    const ribbonRoll = new THREE.Mesh(coreGeo, coreMat);
    targetGroup.add(ribbonRoll);

    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.36, 12), chromeMat);
    targetGroup.add(nut);

    const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.06, 0.12), darkSteelMat);
    spoke.position.y = 0.15;
    targetGroup.add(spoke);
  }
  populateSpool(spoolGroupLeft);
  populateSpool(spoolGroupRight);

  // 7. Ribbon Vibrator Guide & Bichrome Black/Red Cotton Ribbon at the Printing Point
  const vibratorGroup = new THREE.Group();
  vibratorGroup.position.set(0, 3.10, -0.54);
  machineRoot.add(vibratorGroup);

  const forkLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.05), chromeMat);
  forkLeft.position.set(-0.15, 0, 0);
  vibratorGroup.add(forkLeft);

  const forkRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.05), chromeMat);
  forkRight.position.set(0.15, 0, 0);
  vibratorGroup.add(forkRight);

  const blackRibbonMat = new THREE.MeshStandardMaterial({
    color: 0x19181c,
    roughness: 0.88,
    side: THREE.DoubleSide
  });
  const ribbonBlackStrip = new THREE.Mesh(new THREE.PlaneGeometry(6.7, 0.13, 16, 1), blackRibbonMat);
  ribbonBlackStrip.position.set(0, 0.09, 0.02);
  vibratorGroup.add(ribbonBlackStrip);

  const redRibbonMat = new THREE.MeshStandardMaterial({
    color: 0xb02418,
    roughness: 0.82,
    side: THREE.DoubleSide
  });
  const ribbonRedStrip = new THREE.Mesh(new THREE.PlaneGeometry(6.7, 0.11, 16, 1), redRibbonMat);
  ribbonRedStrip.position.set(0, -0.02, 0.022);
  vibratorGroup.add(ribbonRedStrip);

  return {
    machineRoot,
    materials: {
      enamelBodyMat,
      darkSteelMat,
      chromeMat,
      rubberMat
    },
    spoolGroupLeft,
    spoolGroupRight,
    vibratorGroup
  };
}
