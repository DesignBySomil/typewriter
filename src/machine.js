import * as THREE from 'three';
import { createEnamelMaterial, createChromeMaterial } from './shaders/enamel.js';

function createLogoPlateTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#222423';
  ctx.fillRect(0, 0, 512, 96);

  ctx.strokeStyle = '#9e988c';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 88);

  ctx.fillStyle = '#dcd5c7';
  ctx.font = 'bold 38px "Courier Prime", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('olivetti', 256, 36);

  ctx.fillStyle = '#a8a296';
  ctx.font = 'bold 20px "Courier Prime", "Courier New", monospace';
  ctx.fillText('LETTERA 32', 256, 68);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Creates a faint stamped aluminum model & serial number plate texture mounted below the typebasket
 */
function createSerialPlateTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  // Aged dark stamped aluminum background
  ctx.fillStyle = '#2b2d2e';
  ctx.fillRect(0, 0, 512, 96);

  ctx.strokeStyle = 'rgba(155, 150, 140, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, 500, 84);

  // Two small corner rivet circles
  ctx.fillStyle = '#78756e';
  [22, 490].forEach((rx) => {
    ctx.beginPath();
    ctx.arc(rx, 48, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = 'rgba(205, 198, 184, 0.72)';
  ctx.font = 'bold 20px "Courier Prime", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ING. C. OLIVETTI & C., S.p.A. - IVREA', 256, 32);

  ctx.fillStyle = 'rgba(180, 174, 160, 0.65)';
  ctx.font = 'bold 22px "Courier Prime", "Courier New", monospace';
  ctx.fillText('MOD. LETTERA 32   S/N 4810923', 256, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Generates a realistic woven cotton bichrome ribbon texture
 */
function createWovenRibbonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0.0, '#18181a');
  grad.addColorStop(0.48, '#1c1b1d');
  grad.addColorStop(0.56, '#421d1a');
  grad.addColorStop(0.64, '#73241d');
  grad.addColorStop(0.95, '#68201a');
  grad.addColorStop(1.0, '#3d1512');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 64);

  for (let y = 0; y < 64; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? 'rgba(255, 245, 235, 0.04)' : 'rgba(0, 0, 0, 0.14)';
    ctx.fillRect(0, y, 512, 1);
  }
  for (let x = 0; x < 512; x += 3) {
    ctx.fillStyle = x % 6 === 0 ? 'rgba(255, 245, 235, 0.035)' : 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(x, 0, 1, 64);
  }

  for (let i = 0; i < 90; i++) {
    const rx = (Math.abs(Math.sin(i * 43.7)) * 512) % 512;
    const ry = 10 + (Math.abs(Math.cos(i * 91.3)) * 44);
    ctx.fillStyle = 'rgba(210, 200, 185, 0.04)';
    ctx.beginPath();
    ctx.arc(rx, ry, 2 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

/**
 * Helper to create a small slotted screw head mesh (oxidized satin nickel with a dark recessed slot)
 */
function createSlottedScrew(chromeMat, slotMat, radius = 0.065) {
  const screwGroup = new THREE.Group();
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.06, 0.032, 16),
    chromeMat
  );
  screwGroup.add(head);

  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.65, 0.014, radius * 0.28),
    slotMat
  );
  slot.position.y = 0.015;
  screwGroup.add(slot);
  return screwGroup;
}

export function buildMachineChassis(scene) {
  const machineRoot = new THREE.Group();
  scene.add(machineRoot);

  const enamelBodyMat = createEnamelMaterial({
    baseColor: 0x6b7b77,
    metalTint: 0x88908e,
    roughness: 0.78,
    metalness: 0.0
  });

  const darkSteelMat = createEnamelMaterial({
    baseColor: 0x242627,
    metalTint: 0x5c6062,
    roughness: 0.82,
    metalness: 0.0
  });

  const seamGapMat = new THREE.MeshBasicMaterial({ color: 0x0c0d0d });
  const chromeMat = createChromeMaterial();

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x202224,
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.05
  });
  rubberMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRubPos;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvRubPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRubPos;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float rGrain = fract(sin(dot(floor(vRubPos.xy * 120.0), vec2(12.98, 78.23))) * 43758.5) - 0.5;
         diffuseColor.rgb += rGrain * 0.014;`
      );
  };

  const knobPlasticMat = createEnamelMaterial({
    baseColor: 0xcfc9ba,
    metalTint: 0x8e897e,
    roughness: 0.78,
    metalness: 0.0
  });

  // 1. Four Grippy Rubber Feet
  const footGeo = new THREE.CylinderGeometry(0.40, 0.44, 0.20, 20);
  [
    [-4.4, 0.10, -2.3],
    [ 4.4, 0.10, -2.3],
    [-4.4, 0.10,  3.7],
    [ 4.4, 0.10,  3.7]
  ].forEach(([fx, fy, fz]) => {
    const foot = new THREE.Mesh(footGeo, rubberMat);
    foot.position.set(fx, fy, fz);
    foot.castShadow = true;
    foot.receiveShadow = true;
    machineRoot.add(foot);
  });

  // 2. Olivetti Lettera 32 Side Shell Cheeks
  const sideWallShape = new THREE.Shape();
  sideWallShape.moveTo(-3.3, 0.18);
  sideWallShape.lineTo(4.58, 0.18);
  sideWallShape.quadraticCurveTo(4.92, 0.18, 4.82, 0.62);
  sideWallShape.lineTo(1.95, 1.96);
  sideWallShape.quadraticCurveTo(1.40, 2.20, 0.65, 2.26);
  sideWallShape.lineTo(-0.45, 2.75);
  sideWallShape.quadraticCurveTo(-1.05, 3.02, -2.65, 2.96);
  sideWallShape.quadraticCurveTo(-3.25, 2.90, -3.3, 2.25);
  sideWallShape.closePath();

  const sideWallGeo = new THREE.ExtrudeGeometry(sideWallShape, {
    depth: 0.40,
    bevelEnabled: true,
    bevelSegments: 5,
    steps: 1,
    bevelSize: 0.09,
    bevelThickness: 0.09
  });
  sideWallGeo.rotateY(Math.PI / 2);

  const leftWall = new THREE.Mesh(sideWallGeo, enamelBodyMat);
  leftWall.position.set(-5.12, 0, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  machineRoot.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, enamelBodyMat);
  rightWall.position.set(4.72, 0, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  machineRoot.add(rightWall);

  // Inner Deck Guard Strips along the inside of both cheeks
  const cheekLinerGeo = new THREE.BoxGeometry(0.18, 0.34, 3.15);
  const leftCheekLiner = new THREE.Mesh(cheekLinerGeo, enamelBodyMat);
  leftCheekLiner.position.set(-4.64, 1.24, 3.05);
  leftCheekLiner.rotation.x = 0.25;
  leftCheekLiner.castShadow = true;
  leftCheekLiner.receiveShadow = true;
  machineRoot.add(leftCheekLiner);

  const rightCheekLiner = new THREE.Mesh(cheekLinerGeo, enamelBodyMat);
  rightCheekLiner.position.set(4.64, 1.24, 3.05);
  rightCheekLiner.rotation.x = 0.25;
  rightCheekLiner.castShadow = true;
  rightCheekLiner.receiveShadow = true;
  machineRoot.add(rightCheekLiner);

  // 3. Lower Chassis Pan, Recessed Dark Key Mask, Rear Shell & Front Chin Bar
  const basePan = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.28, 7.2), darkSteelMat);
  basePan.position.set(0, 0.30, 0.65);
  basePan.castShadow = true;
  basePan.receiveShadow = true;
  machineRoot.add(basePan);

  const keyMaskPlate = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.12, 3.0), darkSteelMat);
  keyMaskPlate.position.set(0, 0.82, 3.08);
  keyMaskPlate.rotation.x = 0.25;
  keyMaskPlate.receiveShadow = true;
  machineRoot.add(keyMaskPlate);

  const rearHousing = new THREE.Mesh(new THREE.BoxGeometry(9.8, 2.55, 2.0), enamelBodyMat);
  rearHousing.position.set(0, 1.56, -2.18);
  rearHousing.castShadow = true;
  rearHousing.receiveShadow = true;
  machineRoot.add(rearHousing);

  const frontChinBar = new THREE.Mesh(new THREE.BoxGeometry(9.96, 0.42, 0.54), enamelBodyMat);
  frontChinBar.position.set(0, 0.38, 4.54);
  frontChinBar.castShadow = true;
  frontChinBar.receiveShadow = true;
  machineRoot.add(frontChinBar);

  // 4. Raised Rounded Top Cover with Subtle Dark Seam Gap Lines
  const hoodLeft = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.38, 2.62), enamelBodyMat);
  hoodLeft.position.set(-3.58, 2.12, 0.55);
  hoodLeft.rotation.x = 0.20;
  hoodLeft.castShadow = true;
  hoodLeft.receiveShadow = true;
  machineRoot.add(hoodLeft);

  const hoodRight = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.38, 2.62), enamelBodyMat);
  hoodRight.position.set(3.58, 2.12, 0.55);
  hoodRight.rotation.x = 0.20;
  hoodRight.castShadow = true;
  hoodRight.receiveShadow = true;
  machineRoot.add(hoodRight);

  const hoodFrontBridge = new THREE.Mesh(new THREE.BoxGeometry(4.74, 0.32, 0.66), enamelBodyMat);
  hoodFrontBridge.position.set(0, 1.84, 1.58);
  hoodFrontBridge.rotation.x = 0.22;
  hoodFrontBridge.castShadow = true;
  hoodFrontBridge.receiveShadow = true;
  machineRoot.add(hoodFrontBridge);

  // Recessed dark gap lines between top cover and outer shell
  const seamSideGeo = new THREE.BoxGeometry(0.038, 0.39, 2.68);
  const seamOuterLeft = new THREE.Mesh(seamSideGeo, seamGapMat);
  seamOuterLeft.position.set(-4.87, 2.125, 0.55);
  seamOuterLeft.rotation.x = 0.20;
  machineRoot.add(seamOuterLeft);

  const seamOuterRight = new THREE.Mesh(seamSideGeo, seamGapMat);
  seamOuterRight.position.set(4.87, 2.125, 0.55);
  seamOuterRight.rotation.x = 0.20;
  machineRoot.add(seamOuterRight);

  const seamFrontGeo = new THREE.BoxGeometry(9.68, 0.032, 0.045);
  const seamFrontLine = new THREE.Mesh(seamFrontGeo, seamGapMat);
  seamFrontLine.position.set(0, 1.76, 1.91);
  seamFrontLine.rotation.x = 0.22;
  machineRoot.add(seamFrontLine);

  const seamRearLine = new THREE.Mesh(seamFrontGeo, seamGapMat);
  seamRearLine.position.set(0, 2.40, -0.78);
  machineRoot.add(seamRearLine);

  // 4B. Small Visible Slotted Screw Heads on the Top Cover and Side Cheeks
  const topScrewCoords = [
    [-4.55, 2.08, 1.62, 0.20, 0.4],
    [ 4.55, 2.08, 1.62, 0.20, 1.1],
    [-4.55, 2.52, -0.52, 0.20, 2.3],
    [ 4.55, 2.52, -0.52, 0.20, 0.8],
    [-2.05, 1.98, 1.68, 0.22, 1.7],
    [ 2.05, 1.98, 1.68, 0.22, 0.2]
  ];
  topScrewCoords.forEach(([sx, sy, sz, rx, ry]) => {
    const screw = createSlottedScrew(chromeMat, seamGapMat, 0.062);
    screw.position.set(sx, sy, sz);
    screw.rotation.set(rx, ry, 0);
    machineRoot.add(screw);
  });

  // Side cheek screws & inner cheek liner screws
  [
    [-4.63, 1.44, 2.18, 0.25, 0.5],
    [ 4.63, 1.44, 2.18, 0.25, 1.9],
    [-4.63, 0.96, 4.12, 0.25, 1.2],
    [ 4.63, 0.96, 4.12, 0.25, 2.6]
  ].forEach(([sx, sy, sz, rx, ry]) => {
    const screw = createSlottedScrew(chromeMat, seamGapMat, 0.056);
    screw.position.set(sx, sy, sz);
    screw.rotation.set(rx, ry, 0);
    machineRoot.add(screw);
  });

  // Matte Olivetti Lettera 32 Logo Plate on the raised top cover bridge
  const logoMat = new THREE.MeshStandardMaterial({
    map: createLogoPlateTexture(),
    roughness: 0.72,
    metalness: 0.0,
    envMapIntensity: 0.12
  });
  const logoPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.27), logoMat);
  logoPlate.position.set(0, 2.02, 1.62);
  logoPlate.rotation.x = -Math.PI * 0.5 + 0.22;
  machineRoot.add(logoPlate);

  // Faint Stamped Model & Serial Number Plate mounted below the basket
  const serialMat = new THREE.MeshStandardMaterial({
    map: createSerialPlateTexture(),
    roughness: 0.68,
    metalness: 0.35,
    envMapIntensity: 0.16
  });
  const serialPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.31), serialMat);
  serialPlate.position.set(0, 1.36, 0.52);
  serialPlate.rotation.x = -Math.PI * 0.38;
  machineRoot.add(serialPlate);

  // 5. Oxidized Satin-Nickel Rim Around Typebasket Opening
  const basketRimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 2.25), chromeMat);
  basketRimLeft.position.set(-2.32, 2.15, 0.42);
  basketRimLeft.rotation.x = 0.20;
  machineRoot.add(basketRimLeft);

  const basketRimRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 2.25), chromeMat);
  basketRimRight.position.set(2.32, 2.15, 0.42);
  basketRimRight.rotation.x = 0.20;
  machineRoot.add(basketRimRight);

  const basketRimFront = new THREE.Mesh(new THREE.BoxGeometry(4.72, 0.07, 0.08), chromeMat);
  basketRimFront.position.set(0, 1.95, 1.32);
  machineRoot.add(basketRimFront);

  // 6. Dual Ribbon Spools Under Two Small Round Covers with Matte Metal Caps
  const spoolGroupLeft = new THREE.Group();
  spoolGroupLeft.position.set(-3.35, 2.24, 0.42);
  spoolGroupLeft.rotation.x = 0.20;
  machineRoot.add(spoolGroupLeft);

  const spoolGroupRight = new THREE.Group();
  spoolGroupRight.position.set(3.35, 2.24, 0.42);
  spoolGroupRight.rotation.x = 0.20;
  machineRoot.add(spoolGroupRight);

  function populateCoveredSpool(targetGroup) {
    const gapRing = new THREE.Mesh(new THREE.CylinderGeometry(0.79, 0.81, 0.14, 32), seamGapMat);
    gapRing.position.y = -0.03;
    targetGroup.add(gapRing);

    const housingGeo = new THREE.CylinderGeometry(0.74, 0.78, 0.16, 32);
    const housingMesh = new THREE.Mesh(housingGeo, enamelBodyMat);
    housingMesh.position.y = -0.02;
    housingMesh.castShadow = true;
    targetGroup.add(housingMesh);

    const coreGeo = new THREE.CylinderGeometry(0.60, 0.60, 0.18, 24);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x161618, roughness: 0.92, metalness: 0.0 });
    const ribbonRoll = new THREE.Mesh(coreGeo, coreMat);
    targetGroup.add(ribbonRoll);

    const capGeo = new THREE.CylinderGeometry(0.66, 0.70, 0.06, 32);
    const capMesh = new THREE.Mesh(capGeo, chromeMat);
    capMesh.position.y = 0.09;
    capMesh.castShadow = true;
    targetGroup.add(capMesh);

    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 16), darkSteelMat);
    nut.position.y = 0.12;
    targetGroup.add(nut);

    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.03, 0.07), darkSteelMat);
    indicator.position.y = 0.13;
    targetGroup.add(indicator);
  }
  populateCoveredSpool(spoolGroupLeft);
  populateCoveredSpool(spoolGroupRight);

  // 7. Ribbon Vibrator Guide & Woven Cotton Bichrome Ribbon Strip Across the Typing Point
  const vibratorGroup = new THREE.Group();
  vibratorGroup.position.set(0, 2.66, -0.53);
  machineRoot.add(vibratorGroup);

  const forkLeft = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.54, 0.045), chromeMat);
  forkLeft.position.set(-0.15, 0.02, 0.01);
  vibratorGroup.add(forkLeft);

  const forkRight = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.54, 0.045), chromeMat);
  forkRight.position.set(0.15, 0.02, 0.01);
  vibratorGroup.add(forkRight);

  [-1.95, 1.95].forEach((gx) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 12), chromeMat);
    post.position.set(gx, -0.06, 0.18);
    vibratorGroup.add(post);
  });

  const wovenRibbonTex = createWovenRibbonTexture();
  const wovenRibbonMat = new THREE.MeshStandardMaterial({
    map: wovenRibbonTex,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.05,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide
  });

  const ribbonGeo = new THREE.PlaneGeometry(6.4, 0.21, 32, 1);
  const rPos = ribbonGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const rx = rPos.getX(i);
    const absX = Math.abs(rx);
    let rz = 0.025;
    let ry = rPos.getY(i) + 0.04;
    if (absX > 0.35) {
      const t = (absX - 0.35) / 2.85;
      rz += Math.sin(t * Math.PI * 0.5) * 0.62;
      ry -= t * 0.24;
    }
    rPos.setY(i, ry);
    rPos.setZ(i, rz);
  }
  ribbonGeo.computeVertexNormals();

  const ribbonMesh = new THREE.Mesh(ribbonGeo, wovenRibbonMat);
  vibratorGroup.add(ribbonMesh);

  return {
    machineRoot,
    materials: {
      enamelBodyMat,
      darkSteelMat,
      chromeMat,
      rubberMat,
      knobPlasticMat
    },
    spoolGroupLeft,
    spoolGroupRight,
    vibratorGroup
  };
}
