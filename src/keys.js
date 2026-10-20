import * as THREE from 'three';
import { KEY_ROWS, SPECIAL_KEYS } from './config.js';
import { createEnamelMaterial } from './shaders/enamel.js';

let cachedKeyMicroMaps = null;

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
 * Generates a lightly dusty and thumb-scuffed matte dark spacebar texture & roughness map
 */
function createScuffedSpacebarMaterial() {
  const w = 512;
  const h = 128;
  const colCan = document.createElement('canvas');
  colCan.width = w;
  colCan.height = h;
  const cCtx = colCan.getContext('2d');

  const rghCan = document.createElement('canvas');
  rghCan.width = w;
  rghCan.height = h;
  const rCtx = rghCan.getContext('2d');

  // Base dark matte charcoal plastic
  cCtx.fillStyle = '#222324';
  cCtx.fillRect(0, 0, w, h);

  rCtx.fillStyle = '#d8d8d8'; // ~0.85 roughness
  rCtx.fillRect(0, 0, w, h);

  // Subtle dusty accumulation toward the left and right ends & recessed border
  const leftDust = cCtx.createRadialGradient(60, 64, 10, 60, 64, 140);
  leftDust.addColorStop(0, 'rgba(135, 128, 114, 0.22)');
  leftDust.addColorStop(1, 'rgba(135, 128, 114, 0.0)');
  cCtx.fillStyle = leftDust;
  cCtx.fillRect(0, 0, w, h);

  const rightDust = cCtx.createRadialGradient(w - 60, 64, 10, w - 60, 64, 140);
  rightDust.addColorStop(0, 'rgba(135, 128, 114, 0.22)');
  rightDust.addColorStop(1, 'rgba(135, 128, 114, 0.0)');
  cCtx.fillStyle = rightDust;
  cCtx.fillRect(0, 0, w, h);

  // Right-thumb wear patch near center-right (slightly lighter scuffed tone + slightly lower roughness ~0.66)
  const thumbWear = cCtx.createRadialGradient(295, 68, 8, 295, 68, 95);
  thumbWear.addColorStop(0, 'rgba(110, 114, 116, 0.24)');
  thumbWear.addColorStop(1, 'rgba(110, 114, 116, 0.0)');
  cCtx.fillStyle = thumbWear;
  cCtx.fillRect(0, 0, w, h);

  const thumbRough = rCtx.createRadialGradient(295, 68, 8, 295, 68, 95);
  thumbRough.addColorStop(0, 'rgba(165, 165, 165, 0.85)');
  thumbRough.addColorStop(1, 'rgba(216, 216, 216, 0.0)');
  rCtx.fillStyle = thumbRough;
  rCtx.fillRect(0, 0, w, h);

  // Fine horizontal & diagonal scuff marks and dust specks
  for (let i = 0; i < 65; i++) {
    const sx = (Math.abs(Math.sin(i * 47.3)) * w) % w;
    const sy = (Math.abs(Math.cos(i * 89.1)) * h) % h;
    const len = 10 + (i % 24);
    const ang = (Math.sin(i * 19.7) * 0.45);
    cCtx.strokeStyle = i % 2 === 0 ? 'rgba(145, 140, 132, 0.16)' : 'rgba(16, 16, 17, 0.25)';
    cCtx.lineWidth = 1.1;
    cCtx.beginPath();
    cCtx.moveTo(sx, sy);
    cCtx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
    cCtx.stroke();
  }

  // Worn front edge highlight line
  cCtx.strokeStyle = 'rgba(130, 128, 122, 0.32)';
  cCtx.lineWidth = 3;
  cCtx.strokeRect(2, 2, w - 4, h - 4);

  const map = new THREE.CanvasTexture(colCan);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rghCan);

  return new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    roughness: 0.82,
    metalness: 0.0,
    envMapIntensity: 0.12,
    emissive: new THREE.Color(0xc88e4b),
    emissiveIntensity: 0.0
  });
}

function createKeyTopMaterial(primaryLabel, secondaryLabel = '', isSmallLabel = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#191817';
  ctx.fillRect(0, 0, 256, 256);

  const grad = ctx.createRadialGradient(125, 122, 10, 128, 128, 104);
  grad.addColorStop(0.0, '#f7f0df');
  grad.addColorStop(0.72, '#ede2cb');
  grad.addColorStop(0.94, '#d2c5ab');
  grad.addColorStop(1.0, '#191817');

  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = '#141312';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(130, 124, 115, 0.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(128, 128, 108, 0.3, 1.4);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  function drawCrispPrintedGlyph(text, x, y, fontStr, mainColor = '#050504', strokeW = 2.4) {
    ctx.font = fontStr;
    ctx.fillStyle = 'rgba(255, 253, 246, 0.72)';
    ctx.fillText(text, x + 1.5, y + 1.8);
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

  const keyRimGeo  = new THREE.CylinderGeometry(0.285, 0.30, 0.13, 28);
  const keyFaceDiscGeo = new THREE.CircleGeometry(0.278, 28);
  keyFaceDiscGeo.rotateX(-Math.PI / 2);

  // Invisible 1.5x radius hit cylinder (0.43) so mobile touch tapping is effortless
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

  // 3. Lightly Dusty & Scuffed Matte Dark Space Bar
  const spaceGroup = new THREE.Group();
  spaceGroup.position.set(0, 0.56, 4.62);
  machineRoot.add(spaceGroup);

  const spaceBarGeo = new THREE.BoxGeometry(4.75, 0.16, 0.42);
  const spaceBarMat = createScuffedSpacebarMaterial();

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
    controller.pressVel = -1.25;
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

  // Underdamped return spring so keys rebound with a realistic slight upward overshoot before settling
  function updateKeys(dt) {
    for (let i = 0; i < allKeysList.length; i++) {
      const k = allKeysList[i];
      const stiffness = 260.0;
      const damping = 12.0; // Allows a subtle ~0.025 upward spring overshoot on return
      const force = (k.targetPress - k.pressDepth) * stiffness;
      k.pressVel = (k.pressVel + force * dt) * Math.exp(-damping * dt);
      k.pressDepth = THREE.MathUtils.clamp(k.pressDepth + k.pressVel * dt, -0.04, 0.42);

      if (Math.abs(k.pressDepth - k.targetPress) < 0.0008 && Math.abs(k.pressVel) < 0.004) {
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
