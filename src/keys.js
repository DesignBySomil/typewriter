import * as THREE from 'three';
import { KEY_ROWS, SPECIAL_KEYS } from './config.js';
import { createEnamelMaterial } from './shaders/enamel.js';

let cachedKeyMicroMaps = null;

/**
 * Generates shared fine-grain roughnessMap and bumpMap for the matte keytops & worn key rings
 */
function getKeyMicroMaps() {
  if (cachedKeyMicroMaps) return cachedKeyMicroMaps;

  const size = 256;
  const rCan = document.createElement('canvas');
  rCan.width = size;
  rCan.height = size;
  const rCtx = rCan.getContext('2d');

  const bCan = document.createElement('canvas');
  bCan.width = size;
  bCan.height = size;
  const bCtx = bCan.getContext('2d');

  const rImg = rCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const g = Math.abs(Math.sin(x * 79.1 + y * 157.3) * 43758.5) % 1;
      const dx = (x - 128) / 128;
      const dy = (y - 128) / 128;
      const radial = Math.min(1.0, Math.sqrt(dx * dx + dy * dy));
      const rVal = Math.floor(175 + radial * 42 + (g - 0.5) * 20);
      rImg.data[idx] = rVal;
      rImg.data[idx + 1] = rVal;
      rImg.data[idx + 2] = rVal;
      rImg.data[idx + 3] = 255;

      const bVal = Math.floor(120 + (g - 0.5) * 35);
      bImg.data[idx] = bVal;
      bImg.data[idx + 1] = bVal;
      bImg.data[idx + 2] = bVal;
      bImg.data[idx + 3] = 255;
    }
  }
  rCtx.putImageData(rImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  cachedKeyMicroMaps = {
    roughnessMap: new THREE.CanvasTexture(rCan),
    bumpMap: new THREE.CanvasTexture(bCan)
  };
  return cachedKeyMicroMaps;
}

/**
 * Generates an authentic zero-gloss Olivetti Lettera 32 key top material:
 * - Visible worn flat black outer rim ring
 * - High-contrast crisp black printed legends (#050504) on warm cream tops (#f5eddc)
 */
function createKeyTopMaterial(primaryLabel, secondaryLabel = '', isSmallLabel = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Outer flat black rim ring
  ctx.fillStyle = '#191817';
  ctx.fillRect(0, 0, 256, 256);

  // Brighter warm cream / off-white face for higher legend contrast
  const grad = ctx.createRadialGradient(125, 122, 10, 128, 128, 104);
  grad.addColorStop(0.0, '#f7f0df');
  grad.addColorStop(0.72, '#ede2cb');
  grad.addColorStop(0.94, '#d2c5ab');
  grad.addColorStop(1.0, '#191817');

  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Worn flat black inner border separating cream face from rim ring
  ctx.strokeStyle = '#141312';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle wear flecks along the black key ring
  ctx.strokeStyle = 'rgba(130, 124, 115, 0.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(128, 128, 108, 0.3, 1.4);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  function drawCrispPrintedGlyph(text, x, y, fontStr, mainColor = '#050504', strokeW = 2.4) {
    ctx.font = fontStr;
    // Faint warm emboss rim below
    ctx.fillStyle = 'rgba(255, 253, 246, 0.72)';
    ctx.fillText(text, x + 1.5, y + 1.8);
    // Deep pure-black printed legend core
    ctx.fillStyle = mainColor;
    ctx.fillText(text, x, y);
    if (strokeW > 0) {
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = strokeW;
      ctx.strokeText(text, x, y);
    }
  }

  if (isSmallLabel) {
    drawCrispPrintedGlyph(primaryLabel, 128, 130, '900 44px "Courier Prime", "Courier New", monospace', '#050504', 1.8);
  } else if (secondaryLabel && secondaryLabel !== primaryLabel.toUpperCase()) {
    drawCrispPrintedGlyph(secondaryLabel, 128, 78, '900 52px "Courier Prime", "Courier New", monospace', '#11100e', 1.4);
    drawCrispPrintedGlyph(primaryLabel, 128, 158, '900 82px "Courier Prime", "Courier New", monospace', '#040403', 2.4);
  } else {
    const label = primaryLabel.toUpperCase();
    drawCrispPrintedGlyph(label, 128, 132, '900 116px "Courier Prime", "Courier New", monospace', '#040403', 3.2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const { roughnessMap, bumpMap } = getKeyMicroMaps();

  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.72,
    metalness: 0.0,
    roughnessMap,
    bumpMap,
    bumpScale: 0.004,
    envMapIntensity: 0.12,
    emissive: new THREE.Color(0xc88e4b),
    emissiveIntensity: 0.0
  });
}

export function buildKeysSystem(machineRoot, materials) {
  const { chromeMat, darkSteelMat } = materials;
  const { roughnessMap, bumpMap } = getKeyMicroMaps();

  const keyMap = new Map();
  const charToKeyMap = new Map();
  const clickableMeshes = [];
  const allKeysList = [];
  const printableControllers = [];

  // Visual key radius = 0.285
  const keyRimGeo  = new THREE.CylinderGeometry(0.285, 0.30, 0.13, 28);
  const keyFaceDiscGeo = new THREE.CircleGeometry(0.278, 28);
  keyFaceDiscGeo.rotateX(-Math.PI / 2);

  // Invisible 1.5x radius hit cylinder (0.285 * 1.5 = 0.43) so mobile touch tapping is effortless
  const hitTargetGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.28, 16);
  const hitTargetMat = new THREE.MeshBasicMaterial({ visible: false });

  const flatBlackRimMat = new THREE.MeshStandardMaterial({
    color: 0x1a1918,
    roughness: 0.82,
    metalness: 0.0,
    roughnessMap,
    bumpMap,
    bumpScale: 0.005,
    envMapIntensity: 0.10
  });

  const stemGeo = new THREE.CylinderGeometry(0.054, 0.054, 1.0, 12);
  const linkageGeo = new THREE.BoxGeometry(0.038, 0.048, 2.75);

  let barIndexCounter = 0;

  // 1. Build all 44 Printable Keys across 4 Staggered Rows
  KEY_ROWS.forEach((rowDef) => {
    const spacing = rowDef.spacing || 0.64;
    rowDef.keys.forEach((keyDef, idx) => {
      const kx = rowDef.xOffset + idx * spacing;
      const ky = rowDef.y;
      const kz = rowDef.z;

      const keyGroup = new THREE.Group();
      keyGroup.position.set(kx, ky, kz);
      machineRoot.add(keyGroup);

      const blackRim = new THREE.Mesh(keyRimGeo, flatBlackRimMat);
      blackRim.castShadow = true;
      blackRim.receiveShadow = true;
      keyGroup.add(blackRim);

      const topMat = createKeyTopMaterial(keyDef.lower, keyDef.upper, false);
      const faceDisc = new THREE.Mesh(keyFaceDiscGeo, topMat);
      faceDisc.position.y = 0.067;
      keyGroup.add(faceDisc);

      const hitMesh = new THREE.Mesh(hitTargetGeo, hitTargetMat);
      hitMesh.position.y = 0.05;
      keyGroup.add(hitMesh);

      const stem = new THREE.Mesh(stemGeo, chromeMat);
      stem.position.y = -0.48;
      keyGroup.add(stem);

      const linkage = new THREE.Mesh(linkageGeo, darkSteelMat);
      linkage.position.set(0, -0.80, -1.30);
      linkage.rotation.x = 0.14;
      keyGroup.add(linkage);

      const controller = {
        code: keyDef.code,
        lower: keyDef.lower,
        upper: keyDef.upper,
        row: rowDef.row,
        colInRow: idx,
        worldX: kx,
        worldZ: kz,
        barIndex: barIndexCounter++,
        isSpecial: false,
        keyGroup,
        topMat,
        linkage,
        baseY: ky,
        pressDepth: 0,
        pressVel: 0,
        targetPress: 0,
        neighbors: []
      };

      hitMesh.userData.keyController = controller;
      faceDisc.userData.keyController = controller;
      blackRim.userData.keyController = controller;
      clickableMeshes.push(hitMesh, faceDisc, blackRim);

      keyMap.set(keyDef.code, controller);
      charToKeyMap.set(keyDef.lower, controller);
      charToKeyMap.set(keyDef.upper, controller);
      allKeysList.push(controller);
      printableControllers.push(controller);
    });
  });

  // Precompute neighboring keys for subtle sympathetic mechanical ripple
  printableControllers.forEach((k1) => {
    printableControllers.forEach((k2) => {
      if (k1 === k2) return;
      const dist = Math.hypot(k1.worldX - k2.worldX, k1.worldZ - k2.worldZ);
      if (dist < 0.96) {
        k1.neighbors.push({ ctrl: k2, weight: Math.max(0.15, 1.0 - dist / 0.96) });
      }
    });
  });

  // 2. Build Special Keys (Wide Shift Left/Right, Backspace, Return, Ribbon Tab)
  SPECIAL_KEYS.forEach((sDef) => {
    const keyGroup = new THREE.Group();
    keyGroup.position.set(sDef.x, sDef.y, sDef.z);
    machineRoot.add(keyGroup);

    const bGeo = new THREE.CylinderGeometry(sDef.radius, sDef.radius * 1.04, 0.13, 28);
    const dGeo = new THREE.CircleGeometry(sDef.radius * 0.96, 28);
    dGeo.rotateX(-Math.PI / 2);

    const scaleX = sDef.isWide ? 1.24 : 1.0;

    const blackRim = new THREE.Mesh(bGeo, flatBlackRimMat);
    blackRim.scale.set(scaleX, 1, 1);
    blackRim.castShadow = true;
    keyGroup.add(blackRim);

    const topMat = createKeyTopMaterial(sDef.label, '', true);
    const faceDisc = new THREE.Mesh(dGeo, topMat);
    faceDisc.scale.set(scaleX, 1, 1);
    faceDisc.position.y = 0.067;
    keyGroup.add(faceDisc);

    // 1.5x hit target for special keys
    const sHitGeo = new THREE.CylinderGeometry(sDef.radius * 1.5, sDef.radius * 1.5, 0.28, 16);
    const hitMesh = new THREE.Mesh(sHitGeo, hitTargetMat);
    hitMesh.scale.set(scaleX, 1, 1);
    hitMesh.position.y = 0.05;
    keyGroup.add(hitMesh);

    const stem = new THREE.Mesh(stemGeo, chromeMat);
    stem.position.y = -0.48;
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
      targetPress: 0,
      neighbors: []
    };

    hitMesh.userData.keyController = controller;
    faceDisc.userData.keyController = controller;
    blackRim.userData.keyController = controller;
    clickableMeshes.push(hitMesh, faceDisc, blackRim);

    keyMap.set(sDef.code, controller);
    allKeysList.push(controller);
  });

  // 3. Long Matte Dark Space Bar with Worn Edge (centered inside cheeks)
  const spaceGroup = new THREE.Group();
  spaceGroup.position.set(0, 0.56, 4.62);
  machineRoot.add(spaceGroup);

  const spaceBarGeo = new THREE.BoxGeometry(4.75, 0.16, 0.42);
  const spaceBarMat = createEnamelMaterial({
    baseColor: 0x222324,
    metalTint: 0x767b7d,
    roughness: 0.84,
    metalness: 0.0
  });
  spaceBarMat.emissive = new THREE.Color(0xc88e4b);
  spaceBarMat.emissiveIntensity = 0.0;

  const spaceBarMesh = new THREE.Mesh(spaceBarGeo, spaceBarMat);
  spaceBarMesh.castShadow = true;
  spaceBarMesh.receiveShadow = true;
  spaceGroup.add(spaceBarMesh);

  const spaceHitMesh = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.36, 0.78), hitTargetMat);
  spaceGroup.add(spaceHitMesh);

  const spaceArmLeft = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.60), chromeMat);
  spaceArmLeft.position.set(-2.05, -0.05, -0.28);
  spaceGroup.add(spaceArmLeft);

  const spaceArmRight = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.60), chromeMat);
  spaceArmRight.position.set(2.05, -0.05, -0.28);
  spaceGroup.add(spaceArmRight);

  const spaceController = {
    code: 'Space',
    label: 'SPACE',
    isSpecial: true,
    keyGroup: spaceGroup,
    topMat: spaceBarMat,
    baseY: 0.56,
    pressDepth: 0,
    pressVel: 0,
    targetPress: 0,
    neighbors: []
  };
  spaceBarMesh.userData.keyController = spaceController;
  spaceHitMesh.userData.keyController = spaceController;
  clickableMeshes.push(spaceBarMesh, spaceHitMesh);
  keyMap.set('Space', spaceController);
  allKeysList.push(spaceController);

  function depressKey(controller, depth = 0.34) {
    if (!controller) return;
    controller.pressDepth = depth;
    controller.pressVel = -1.1;
    if (controller.topMat) {
      controller.topMat.emissiveIntensity = 0.16;
    }

    if (controller.neighbors && controller.neighbors.length > 0) {
      for (let i = 0; i < controller.neighbors.length; i++) {
        const n = controller.neighbors[i];
        n.ctrl.pressDepth = Math.max(n.ctrl.pressDepth, depth * 0.18 * n.weight);
        n.ctrl.pressVel -= 0.25 * n.weight;
      }
    }
  }

  function updateKeys(dt) {
    for (let i = 0; i < allKeysList.length; i++) {
      const k = allKeysList[i];
      const stiffness = 195.0;
      const damping = 15.5;
      const force = (k.targetPress - k.pressDepth) * stiffness;
      k.pressVel = (k.pressVel + force * dt) * Math.exp(-damping * dt);
      k.pressDepth += k.pressVel * dt;

      if (Math.abs(k.pressDepth - k.targetPress) < 0.001 && Math.abs(k.pressVel) < 0.005) {
        k.pressDepth = k.targetPress;
        k.pressVel = 0;
      }

      k.keyGroup.position.y = k.baseY - k.pressDepth;

      if (k.topMat) {
        const targetGlow = Math.min(0.16, Math.max(0.0, (k.pressDepth / 0.34) * 0.15));
        k.topMat.emissiveIntensity += (targetGlow - k.topMat.emissiveIntensity) * Math.min(1.0, dt * 18.0);
      }

      if (k.linkage) {
        k.linkage.rotation.x = 0.14 + k.pressDepth * 0.58;
        k.linkage.position.z = -1.30 - k.pressDepth * 0.45;
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
