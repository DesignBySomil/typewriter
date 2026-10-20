import * as THREE from 'three';
import { KEY_ROWS, SPECIAL_KEYS } from './config.js';
import { createEnamelMaterial } from './shaders/enamel.js';

/**
 * Generates an upright, centered, distortion-free 256x256 CanvasTexture for a round key top.
 * Shows the shifted symbol small above the main legend for dual-symbol keys.
 */
function createKeyTopMaterial(primaryLabel, secondaryLabel = '', isSmallLabel = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Warm cream-white vintage Bakelite key background with concave dish shading
  const grad = ctx.createRadialGradient(128, 116, 16, 128, 128, 124);
  grad.addColorStop(0, '#fff9ec');
  grad.addColorStop(0.76, '#eee0c5');
  grad.addColorStop(1, '#c2b092');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Crisp inner ring
  ctx.strokeStyle = 'rgba(55, 44, 32, 0.28)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(128, 128, 106, 0, Math.PI * 2);
  ctx.stroke();

  // Upright dark engraved legend
  ctx.fillStyle = '#171310';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isSmallLabel) {
    ctx.font = 'bold 42px "Courier Prime", "Courier New", monospace';
    ctx.fillText(primaryLabel, 128, 130);
  } else if (secondaryLabel && secondaryLabel !== primaryLabel.toUpperCase()) {
    // Dual-legend key: shifted symbol small above, primary character below
    ctx.fillStyle = '#3a3028';
    ctx.font = 'bold 54px "Courier Prime", "Courier New", monospace';
    ctx.fillText(secondaryLabel, 128, 82);

    ctx.fillStyle = '#14110e';
    ctx.font = 'bold 76px "Courier Prime", "Courier New", monospace';
    ctx.fillText(primaryLabel, 128, 162);
  } else {
    // Single uppercase letter centered upright
    ctx.font = 'bold 112px "Courier Prime", "Courier New", monospace';
    ctx.fillText(primaryLabel.toUpperCase(), 128, 132);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.20,
    metalness: 0.04
  });

  // Add glass clearcoat specular & fresnel highlight on key tops
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vKeyWPos;\nvarying vec3 vKeyWNorm;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvKeyWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvKeyWNorm = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vKeyWPos;\nvarying vec3 vKeyWNorm;`)
      .replace(
        '#include <dithering_fragment>',
        `vec3 vD = normalize(cameraPosition - vKeyWPos);
         vec3 nD = normalize(vKeyWNorm);
         float keyFres = pow(1.0 - clamp(dot(nD, vD), 0.0, 1.0), 3.0);
         vec3 kDir = normalize(vec3(4.0, 11.0, 7.0));
         float kSpec = pow(max(dot(nD, normalize(kDir + vD)), 0.0), 72.0);
         gl_FragColor.rgb += vec3(0.98, 0.92, 0.80) * (keyFres * 0.20 + kSpec * 0.42);
         #include <dithering_fragment>`
      );
  };

  return mat;
}

export function buildKeysSystem(machineRoot, materials) {
  const { chromeMat, darkSteelMat } = materials;

  const keyMap = new Map();       // code -> keyController
  const charToKeyMap = new Map(); // char -> keyController
  const clickableMeshes = [];
  const allKeysList = [];
  const printableControllers = [];

  const keyBezelGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.13, 28);
  const keyBodyGeo  = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 28);
  // Dedicated upright circular disc for the legend so UV orientation is 100% upright & never rotated
  const keyFaceDiscGeo = new THREE.CircleGeometry(0.278, 28);
  keyFaceDiscGeo.rotateX(-Math.PI / 2);

  const keyRimMat = new THREE.MeshStandardMaterial({ color: 0xe6d6b8, roughness: 0.28 });
  const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8);
  const linkageGeo = new THREE.BoxGeometry(0.038, 0.052, 2.85);

  let barIndexCounter = 0;

  // 1. Build all 44 Printable Keys across 4 Rows
  KEY_ROWS.forEach((rowDef) => {
    const spacing = 0.72;
    rowDef.keys.forEach((keyDef, idx) => {
      const kx = rowDef.xOffset + idx * spacing;
      const ky = rowDef.y;
      const kz = rowDef.z;

      const keyGroup = new THREE.Group();
      keyGroup.position.set(kx, ky, kz);
      machineRoot.add(keyGroup);

      const bezel = new THREE.Mesh(keyBezelGeo, chromeMat);
      bezel.castShadow = true;
      bezel.receiveShadow = true;
      keyGroup.add(bezel);

      const capBody = new THREE.Mesh(keyBodyGeo, keyRimMat);
      capBody.position.y = 0.05;
      capBody.castShadow = true;
      keyGroup.add(capBody);

      const topMat = createKeyTopMaterial(keyDef.lower, keyDef.upper, false);
      const faceDisc = new THREE.Mesh(keyFaceDiscGeo, topMat);
      faceDisc.position.y = 0.082;
      keyGroup.add(faceDisc);

      const stem = new THREE.Mesh(stemGeo, darkSteelMat);
      stem.position.y = -0.45;
      keyGroup.add(stem);

      const linkage = new THREE.Mesh(linkageGeo, darkSteelMat);
      linkage.position.set(0, -0.82, -1.35);
      linkage.rotation.x = 0.14;
      keyGroup.add(linkage);

      const controller = {
        code: keyDef.code,
        lower: keyDef.lower,
        upper: keyDef.upper,
        barIndex: barIndexCounter++,
        isSpecial: false,
        keyGroup,
        linkage,
        baseY: ky,
        pressDepth: 0,
        pressVel: 0,
        targetPress: 0
      };

      faceDisc.userData.keyController = controller;
      capBody.userData.keyController = controller;
      bezel.userData.keyController = controller;
      clickableMeshes.push(faceDisc, capBody, bezel);

      keyMap.set(keyDef.code, controller);
      charToKeyMap.set(keyDef.lower, controller);
      charToKeyMap.set(keyDef.upper, controller);
      allKeysList.push(controller);
      printableControllers.push(controller);
    });
  });

  // 2. Build Special Keys (Shift L/R, Backspace, Return, Ribbon Tab)
  SPECIAL_KEYS.forEach((sDef) => {
    const keyGroup = new THREE.Group();
    keyGroup.position.set(sDef.x, sDef.y, sDef.z);
    machineRoot.add(keyGroup);

    const bGeo = new THREE.CylinderGeometry(sDef.radius, sDef.radius * 1.05, 0.13, 28);
    const cGeo = new THREE.CylinderGeometry(sDef.radius * 0.86, sDef.radius * 0.86, 0.06, 28);
    const dGeo = new THREE.CircleGeometry(sDef.radius * 0.85, 28);
    dGeo.rotateX(-Math.PI / 2);

    const bezel = new THREE.Mesh(bGeo, chromeMat);
    bezel.castShadow = true;
    keyGroup.add(bezel);

    const capBody = new THREE.Mesh(cGeo, keyRimMat);
    capBody.position.y = 0.05;
    keyGroup.add(capBody);

    const topMat = createKeyTopMaterial(sDef.label, '', true);
    const faceDisc = new THREE.Mesh(dGeo, topMat);
    faceDisc.position.y = 0.082;
    keyGroup.add(faceDisc);

    const stem = new THREE.Mesh(stemGeo, darkSteelMat);
    stem.position.y = -0.45;
    keyGroup.add(stem);

    const controller = {
      code: sDef.code,
      label: sDef.label,
      isSpecial: true,
      keyGroup,
      baseY: sDef.y,
      pressDepth: 0,
      pressVel: 0,
      targetPress: 0
    };

    faceDisc.userData.keyController = controller;
    capBody.userData.keyController = controller;
    bezel.userData.keyController = controller;
    clickableMeshes.push(faceDisc, capBody, bezel);

    keyMap.set(sDef.code, controller);
    allKeysList.push(controller);
  });

  // 3. Long Cream-White Space Bar at Front Row
  const spaceGroup = new THREE.Group();
  spaceGroup.position.set(0, 0.64, 4.92);
  machineRoot.add(spaceGroup);

  const spaceBarGeo = new THREE.BoxGeometry(5.2, 0.16, 0.46);
  const spaceBarMat = createEnamelMaterial({
    baseColor: 0xeee0c5,
    fresnelTint: 0xffffff,
    roughness: 0.22,
    metalness: 0.05,
    clearcoatBoost: 0.85
  });
  const spaceBarMesh = new THREE.Mesh(spaceBarGeo, spaceBarMat);
  spaceBarMesh.castShadow = true;
  spaceBarMesh.receiveShadow = true;
  spaceGroup.add(spaceBarMesh);

  const spaceArmLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.65), chromeMat);
  spaceArmLeft.position.set(-2.3, -0.06, -0.3);
  spaceGroup.add(spaceArmLeft);

  const spaceArmRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.65), chromeMat);
  spaceArmRight.position.set(2.3, -0.06, -0.3);
  spaceGroup.add(spaceArmRight);

  const spaceController = {
    code: 'Space',
    label: 'SPACE',
    isSpecial: true,
    keyGroup: spaceGroup,
    baseY: 0.64,
    pressDepth: 0,
    pressVel: 0,
    targetPress: 0
  };
  spaceBarMesh.userData.keyController = spaceController;
  clickableMeshes.push(spaceBarMesh);
  keyMap.set('Space', spaceController);
  allKeysList.push(spaceController);

  // Trigger a spring-loaded key depression
  function depressKey(controller, depth = 0.16) {
    if (!controller) return;
    controller.pressDepth = depth;
    controller.pressVel = -0.6;
  }

  // Update spring-back physics for all keys and linkage rods
  function updateKeys(dt) {
    for (let i = 0; i < allKeysList.length; i++) {
      const k = allKeysList[i];
      const stiffness = 240.0;
      const damping = 18.0;
      const force = (k.targetPress - k.pressDepth) * stiffness;
      k.pressVel = (k.pressVel + force * dt) * Math.exp(-damping * dt);
      k.pressDepth += k.pressVel * dt;

      if (Math.abs(k.pressDepth - k.targetPress) < 0.001 && Math.abs(k.pressVel) < 0.005) {
        k.pressDepth = k.targetPress;
        k.pressVel = 0;
      }

      k.keyGroup.position.y = k.baseY - k.pressDepth;
      if (k.linkage) {
        k.linkage.rotation.x = 0.14 + k.pressDepth * 0.45;
        k.linkage.position.z = -1.35 - k.pressDepth * 0.35;
      }
    }
  }

  return {
    keyMap,
    charToKeyMap,
    clickableMeshes,
    allKeysList,
    printableControllers,
    depressKey,
    updateKeys
  };
}
