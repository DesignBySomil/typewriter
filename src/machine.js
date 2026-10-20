import * as THREE from 'three';
import { createEnamelMaterial, createChromeMaterial } from './shaders/enamel.js';

/**
 * Creates a crisp vintage "olivetti / LETTERA 32" front logo badge texture
 */
function createLogoPlateTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#202322';
  ctx.fillRect(0, 0, 512, 96);

  ctx.strokeStyle = '#b8b2a6';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 88);

  ctx.fillStyle = '#e6e0d4';
  ctx.font = 'bold 38px "Courier Prime", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('olivetti', 256, 36);

  ctx.fillStyle = '#b8b2a6';
  ctx.font = 'bold 20px "Courier Prime", "Courier New", monospace';
  ctx.fillText('LETTERA 32', 256, 68);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Builds the 1963 Olivetti Lettera 32 Chassis:
 * - Compact low-slung proportions (width : depth : height ~ 1.0 : 0.85 : 0.32 -> 10.2w x 8.6d x 3.2h)
 * - Matte pale sage-grey-green crinkle/hammertone paint
 * - Sloped front keyboard deck, raised rounded top cover with logo plate
 * - Aged satin-nickel bezel rim around the typebasket opening
 * - Ribbon spools tucked under two round covers with matte metal caps
 */
export function buildMachineChassis(scene) {
  const machineRoot = new THREE.Group();
  scene.add(machineRoot);

  // Authentic Lettera 32 Matte Crinkle Sage/Slate-Green Paint
  const enamelBodyMat = createEnamelMaterial({
    baseColor: 0x6e807d,
    metalTint: 0xa0aaa8,
    roughness: 0.64,
    metalness: 0.14
  });

  // Darker Matte Charcoal Steel for inner well, spacebar & mechanical linkages
  const darkSteelMat = createEnamelMaterial({
    baseColor: 0x262829,
    metalTint: 0x6e7375,
    roughness: 0.68,
    metalness: 0.25
  });

  // Aged Satin Nickel (roughness ~0.35, warm patina)
  const chromeMat = createChromeMaterial();

  // High-roughness dark grey rubber (roughness 0.90) with subtle micro-texture
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x232527,
    roughness: 0.90,
    metalness: 0.02,
    envMapIntensity: 0.20
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
         diffuseColor.rgb += rGrain * 0.015;`
      );
  };

  // Off-white / grey-ivory matte plastic for the ribbed Lettera 32 platen knobs
  const knobPlasticMat = new THREE.MeshStandardMaterial({
    color: 0xd8d3c5,
    roughness: 0.58,
    metalness: 0.04,
    envMapIntensity: 0.35
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

  // 2. Low-Slung Olivetti Lettera 32 Side Shell Walls (Width 10.2, Depth 8.5, Height 3.1)
  const sideWallShape = new THREE.Shape();
  sideWallShape.moveTo(-3.3, 0.18);
  sideWallShape.lineTo(4.45, 0.18);
  sideWallShape.quadraticCurveTo(4.78, 0.18, 4.70, 0.58);
  // Sloped front keyboard deck
  sideWallShape.lineTo(1.85, 1.88);
  sideWallShape.quadraticCurveTo(1.35, 2.12, 0.65, 2.22);
  // Raised rounded top cover
  sideWallShape.lineTo(-0.45, 2.75);
  sideWallShape.quadraticCurveTo(-1.05, 3.02, -2.65, 2.96);
  sideWallShape.quadraticCurveTo(-3.25, 2.90, -3.3, 2.25);
  sideWallShape.closePath();

  const sideWallGeo = new THREE.ExtrudeGeometry(sideWallShape, {
    depth: 0.38,
    bevelEnabled: true,
    bevelSegments: 5,
    steps: 1,
    bevelSize: 0.09,
    bevelThickness: 0.09
  });
  sideWallGeo.rotateY(Math.PI / 2);

  const leftWall = new THREE.Mesh(sideWallGeo, enamelBodyMat);
  leftWall.position.set(-5.05, 0, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  machineRoot.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, enamelBodyMat);
  rightWall.position.set(4.67, 0, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  machineRoot.add(rightWall);

  // 3. Lower Chassis Pan, Rear Shell & Low Front Chin Bar
  const basePan = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.28, 7.2), darkSteelMat);
  basePan.position.set(0, 0.30, 0.65);
  basePan.castShadow = true;
  basePan.receiveShadow = true;
  machineRoot.add(basePan);

  // Recessed dark keyboard mask plate under the 4 staggered key rows
  const keyMaskPlate = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.12, 2.9), darkSteelMat);
  keyMaskPlate.position.set(0, 0.86, 3.12);
  keyMaskPlate.rotation.x = 0.26;
  keyMaskPlate.receiveShadow = true;
  machineRoot.add(keyMaskPlate);

  const rearHousing = new THREE.Mesh(new THREE.BoxGeometry(9.8, 2.55, 2.0), enamelBodyMat);
  rearHousing.position.set(0, 1.56, -2.18);
  rearHousing.castShadow = true;
  rearHousing.receiveShadow = true;
  machineRoot.add(rearHousing);

  const frontChinBar = new THREE.Mesh(new THREE.BoxGeometry(9.88, 0.40, 0.52), enamelBodyMat);
  frontChinBar.position.set(0, 0.38, 4.46);
  frontChinBar.castShadow = true;
  frontChinBar.receiveShadow = true;
  machineRoot.add(frontChinBar);

  // 4. Raised Rounded Top Cover with Spool Covers & Central Typebasket Opening
  const hoodLeft = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.38, 2.65), enamelBodyMat);
  hoodLeft.position.set(-3.62, 2.12, 0.55);
  hoodLeft.rotation.x = 0.20;
  hoodLeft.castShadow = true;
  hoodLeft.receiveShadow = true;
  machineRoot.add(hoodLeft);

  const hoodRight = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.38, 2.65), enamelBodyMat);
  hoodRight.position.set(3.62, 2.12, 0.55);
  hoodRight.rotation.x = 0.20;
  hoodRight.castShadow = true;
  hoodRight.receiveShadow = true;
  machineRoot.add(hoodRight);

  const hoodFrontBridge = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.32, 0.68), enamelBodyMat);
  hoodFrontBridge.position.set(0, 1.84, 1.58);
  hoodFrontBridge.rotation.x = 0.22;
  hoodFrontBridge.castShadow = true;
  hoodFrontBridge.receiveShadow = true;
  machineRoot.add(hoodFrontBridge);

  // Olivetti Lettera 32 Logo Plate on the raised top cover bridge
  const logoMat = new THREE.MeshStandardMaterial({
    map: createLogoPlateTexture(),
    roughness: 0.45,
    metalness: 0.35
  });
  const logoPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.27), logoMat);
  logoPlate.position.set(0, 2.02, 1.62);
  logoPlate.rotation.x = -Math.PI * 0.5 + 0.22;
  machineRoot.add(logoPlate);

  // 5. Satin-Nickel Rim Around Typebasket Opening & Front Bezel
  const basketRimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 2.25), chromeMat);
  basketRimLeft.position.set(-2.34, 2.16, 0.42);
  basketRimLeft.rotation.x = 0.20;
  machineRoot.add(basketRimLeft);

  const basketRimRight = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 2.25), chromeMat);
  basketRimRight.position.set(2.34, 2.16, 0.42);
  basketRimRight.rotation.x = 0.20;
  machineRoot.add(basketRimRight);

  const basketRimFront = new THREE.Mesh(new THREE.BoxGeometry(4.76, 0.08, 0.09), chromeMat);
  basketRimFront.position.set(0, 1.96, 1.32);
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
    // Lower housing ring in body paint
    const housingGeo = new THREE.CylinderGeometry(0.76, 0.80, 0.16, 32);
    const housingMesh = new THREE.Mesh(housingGeo, enamelBodyMat);
    housingMesh.position.y = -0.02;
    housingMesh.castShadow = true;
    targetGroup.add(housingMesh);

    // Dark ribbon roll glimpsed inside
    const coreGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.18, 24);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x161618, roughness: 0.90 });
    const ribbonRoll = new THREE.Mesh(coreGeo, coreMat);
    targetGroup.add(ribbonRoll);

    // Round matte metal cover cap on top with knurled center nut
    const capGeo = new THREE.CylinderGeometry(0.68, 0.72, 0.06, 32);
    const capMesh = new THREE.Mesh(capGeo, chromeMat);
    capMesh.position.y = 0.09;
    capMesh.castShadow = true;
    targetGroup.add(capMesh);

    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 16), darkSteelMat);
    nut.position.y = 0.12;
    targetGroup.add(nut);

    // Subtle indicator bar so spool rotation is visible
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.03, 0.07), darkSteelMat);
    indicator.position.y = 0.13;
    targetGroup.add(indicator);
  }
  populateCoveredSpool(spoolGroupLeft);
  populateCoveredSpool(spoolGroupRight);

  // 7. Ribbon Vibrator Guide & Bichrome Cotton Ribbon at the Printing Point
  const vibratorGroup = new THREE.Group();
  vibratorGroup.position.set(0, 2.66, -0.54);
  machineRoot.add(vibratorGroup);

  const forkLeft = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.52, 0.045), chromeMat);
  forkLeft.position.set(-0.14, 0, 0);
  vibratorGroup.add(forkLeft);

  const forkRight = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.52, 0.045), chromeMat);
  forkRight.position.set(0.14, 0, 0);
  vibratorGroup.add(forkRight);

  const blackRibbonMat = new THREE.MeshStandardMaterial({
    color: 0x18171a,
    roughness: 0.92,
    side: THREE.DoubleSide
  });
  const ribbonBlackStrip = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 0.12, 16, 1), blackRibbonMat);
  ribbonBlackStrip.position.set(0, 0.08, 0.02);
  vibratorGroup.add(ribbonBlackStrip);

  const redRibbonMat = new THREE.MeshStandardMaterial({
    color: 0x9e241b,
    roughness: 0.88,
    side: THREE.DoubleSide
  });
  const ribbonRedStrip = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 0.10, 16, 1), redRibbonMat);
  ribbonRedStrip.position.set(0, -0.02, 0.022);
  vibratorGroup.add(ribbonRedStrip);

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
