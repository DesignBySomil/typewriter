import * as THREE from 'three';
import { KEY_ROWS, SPECIAL_KEYS } from './config.js';
import { createEnamelMaterial } from './shaders/enamel.js';

/**
 * Generates an upright, centered, bold black legend on a warm cream key top with a darker vintage rim.
 * Also supports `uPressGlow` uniform so a depressed key gets a subtle warm amber highlight.
 */
function createKeyTopMaterial(primaryLabel, secondaryLabel = '', isSmallLabel = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Warm cream-white vintage Bakelite dish with darker outer rim
  const grad = ctx.createRadialGradient(128, 118, 14, 128, 128, 126);
  grad.addColorStop(0.0, '#fffaf0');
  grad.addColorStop(0.68, '#efe1c6');
  grad.addColorStop(0.86, '#c4b08e');
  grad.addColorStop(1.0, '#78684e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Crisp dark vintage inner ring
  ctx.strokeStyle = 'rgba(42, 33, 23, 0.42)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 128, 106, 0, Math.PI * 2);
  ctx.stroke();

  // Bold pure-black upright legend
  ctx.fillStyle = '#090807';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isSmallLabel) {
    ctx.font = '900 44px "Courier Prime", "Courier New", monospace';
    ctx.fillText(primaryLabel, 128, 130);
    ctx.strokeStyle = '#090807';
    ctx.lineWidth = 1.5;
    ctx.strokeText(primaryLabel, 128, 130);
  } else if (secondaryLabel && secondaryLabel !== primaryLabel.toUpperCase()) {
    // Dual-legend key: shifted symbol small above, bold main character below
    ctx.fillStyle = '#1e1915';
    ctx.font = 'bold 56px "Courier Prime", "Courier New", monospace';
    ctx.fillText(secondaryLabel, 128, 78);

    ctx.fillStyle = '#070605';
    ctx.font = '900 84px "Courier Prime", "Courier New", monospace';
    ctx.fillText(primaryLabel, 128, 162);
    ctx.strokeStyle = '#070605';
    ctx.lineWidth = 2.0;
    ctx.strokeText(primaryLabel, 128, 162);
  } else {
    // Single uppercase letter centered upright & extra bold
    const label = primaryLabel.toUpperCase();
    ctx.font = '900 120px "Courier Prime", "Courier New", monospace';
    ctx.fillText(label, 128, 134);
    ctx.strokeStyle = '#070605';
    ctx.lineWidth = 3.0;
    ctx.strokeText(label, 128, 134);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.18,
    metalness: 0.04,
    emissive: new THREE.Color(0xffa84c),
    emissiveIntensity: 0.0
  });

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
         float kSpec = pow(max(dot(nD, normalize(kDir + vD)), 0.0), 76.0);
         gl_FragColor.rgb += vec3(0.98, 0.92, 0.80) * (keyFres * 0.22 + kSpec * 0.44);
         #include <dithering_fragment>`
      );
  };

  return mat;
}

export function buildKeysSystem(machineRoot, materials) {
  const { chromeMat, darkSteelMat } = materials;

  const keyMap = new Map();
  const charToKeyMap = new Map();
  const clickableMeshes = [];
  const allKeysList = [];
  const printableControllers = [];

  const keyBezelGeo = new THREE.CylinderGeometry(0.325, 0.345, 0.13, 28);
  const keyBodyGeo  = new THREE.CylinderGeometry(0.285, 0.295, 0.07, 28);
  const keyFaceDiscGeo = new THREE.CircleGeometry(0.282, 28);
  keyFaceDiscGeo.rotateX(-Math.PI / 2);

  // Darker vintage rim for the key cap cylinder
  const keyRimMat = new THREE.MeshStandardMaterial({
    color: 0x9e8c6e,
    roughness: 0.32,
    metalness: 0.08
  });

  // Bright chrome stem so the exposed metal shaft is clearly visible beneath each key
  const stemGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.95, 12);
  const linkageGeo = new THREE.BoxGeometry(0.042, 0.055, 2.85);

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
      capBody.position.y = 0.052;
      capBody.castShadow = true;
      keyGroup.add(capBody);

      const topMat = createKeyTopMaterial(keyDef.lower, keyDef.upper, false);
      const faceDisc = new THREE.Mesh(keyFaceDiscGeo, topMat);
      faceDisc.position.y = 0.088;
      keyGroup.add(faceDisc);

      const stem = new THREE.Mesh(stemGeo, chromeMat);
      stem.position.y = -0.46;
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
        topMat,
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
    const cGeo = new THREE.CylinderGeometry(sDef.radius * 0.87, sDef.radius * 0.89, 0.07, 28);
    const dGeo = new THREE.CircleGeometry(sDef.radius * 0.86, 28);
    dGeo.rotateX(-Math.PI / 2);

    const bezel = new THREE.Mesh(bGeo, chromeMat);
    bezel.castShadow = true;
    keyGroup.add(bezel);

    const capBody = new THREE.Mesh(cGeo, keyRimMat);
    capBody.position.y = 0.052;
    keyGroup.add(capBody);

    const topMat = createKeyTopMaterial(sDef.label, '', true);
    const faceDisc = new THREE.Mesh(dGeo, topMat);
    faceDisc.position.y = 0.088;
    keyGroup.add(faceDisc);

    const stem = new THREE.Mesh(stemGeo, chromeMat);
    stem.position.y = -0.46;
    keyGroup.add(stem);

    const controller = {
      code: sDef.code,
      label: sDef.label,
      isSpecial: true,
      keyGroup,
      topMat,
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
    baseColor: 0xefe1c6,
    fresnelTint: 0xffffff,
    roughness: 0.20,
    metalness: 0.05,
    clearcoatBoost: 0.9
  });
  spaceBarMat.emissive = new THREE.Color(0xffa84c);
  spaceBarMat.emissiveIntensity = 0.0;

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
    topMat: spaceBarMat,
    baseY: 0.64,
    pressDepth: 0,
    pressVel: 0,
    targetPress: 0
  };
  spaceBarMesh.userData.keyController = spaceController;
  clickableMeshes.push(spaceBarMesh);
  keyMap.set('Space', spaceController);
  allKeysList.push(spaceController);

  // Trigger a clear physical depression + warm highlight
  function depressKey(controller, depth = 0.22) {
    if (!controller) return;
    controller.pressDepth = depth;
    controller.pressVel = -0.75;
    if (controller.topMat) {
      controller.topMat.emissiveIntensity = 0.42;
    }
  }

  function updateKeys(dt) {
    for (let i = 0; i < allKeysList.length; i++) {
      const k = allKeysList[i];
      const stiffness = 210.0;
      const damping = 16.5;
      const force = (k.targetPress - k.pressDepth) * stiffness;
      k.pressVel = (k.pressVel + force * dt) * Math.exp(-damping * dt);
      k.pressDepth += k.pressVel * dt;

      if (Math.abs(k.pressDepth - k.targetPress) < 0.001 && Math.abs(k.pressVel) < 0.005) {
        k.pressDepth = k.targetPress;
        k.pressVel = 0;
      }

      k.keyGroup.position.y = k.baseY - k.pressDepth;

      // Subtle warm highlight on depressed keycap
      if (k.topMat) {
        const targetGlow = Math.min(0.45, (k.pressDepth / 0.22) * 0.42);
        k.topMat.emissiveIntensity += (targetGlow - k.topMat.emissiveIntensity) * Math.min(1.0, dt * 20.0);
      }

      if (k.linkage) {
        k.linkage.rotation.x = 0.14 + k.pressDepth * 0.52;
        k.linkage.position.z = -1.35 - k.pressDepth * 0.42;
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
