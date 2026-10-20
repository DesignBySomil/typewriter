import * as THREE from 'three';
import { KEY_ROWS, SPECIAL_KEYS } from './config.js';
import { createEnamelMaterial } from './shaders/enamel.js';

/**
 * Generates an authentic Olivetti Lettera 32 key top texture:
 * - Visible flat black outer rim ring
 * - Low-gloss cream / off-white inner face (roughness ~0.48, not shiny)
 * - Subtle low-frequency fingerprint/smudge shading
 * - Crisp black upright centered legends with faint emboss
 */
function createKeyTopMaterial(primaryLabel, secondaryLabel = '', isSmallLabel = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Outer flat black rim ring
  ctx.fillStyle = '#181716';
  ctx.fillRect(0, 0, 256, 256);

  // Inner cream / off-white concave top with subtle smudge shading
  const grad = ctx.createRadialGradient(124, 120, 12, 128, 128, 104);
  grad.addColorStop(0.0, '#f4eedf');
  grad.addColorStop(0.75, '#e8dec9');
  grad.addColorStop(0.95, '#cfc3ab');
  grad.addColorStop(1.0, '#181716');

  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Crisp flat black inner border separating cream face from rim ring
  ctx.strokeStyle = '#141312';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  function drawEmbossedGlyph(text, x, y, fontStr, mainColor = '#11100f', strokeW = 1.6) {
    ctx.font = fontStr;
    ctx.fillStyle = 'rgba(255, 252, 245, 0.75)';
    ctx.fillText(text, x + 1.8, y + 2.0);
    ctx.fillStyle = mainColor;
    ctx.fillText(text, x, y);
    if (strokeW > 0) {
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = strokeW;
      ctx.strokeText(text, x, y);
    }
  }

  if (isSmallLabel) {
    drawEmbossedGlyph(primaryLabel, 128, 130, '900 42px "Courier Prime", "Courier New", monospace', '#11100f', 1.2);
  } else if (secondaryLabel && secondaryLabel !== primaryLabel.toUpperCase()) {
    drawEmbossedGlyph(secondaryLabel, 128, 78, 'bold 50px "Courier Prime", "Courier New", monospace', '#221f1d', 0.8);
    drawEmbossedGlyph(primaryLabel, 128, 158, '900 78px "Courier Prime", "Courier New", monospace', '#0d0c0b', 1.8);
  } else {
    const label = primaryLabel.toUpperCase();
    drawEmbossedGlyph(label, 128, 132, '900 112px "Courier Prime", "Courier New", monospace', '#0d0c0b', 2.4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  // Low-gloss satin glass-like top (roughness 0.46, subtle smudge variation)
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.46,
    metalness: 0.02,
    envMapIntensity: 0.35,
    emissive: new THREE.Color(0xd99b52),
    emissiveIntensity: 0.0
  });

  return mat;
}

export function buildKeysSystem(machineRoot, materials) {
  const { chromeMat, darkSteelMat } = materials;

  const keyMap = new Map();
  const charToKeyMap = new Map();
  const clickableMeshes = [];
  const allKeysList = [];
  const printableControllers = [];

  // Flat black rim ring body + low-gloss cream top disc
  const keyRimGeo  = new THREE.CylinderGeometry(0.315, 0.33, 0.13, 28);
  const keyFaceDiscGeo = new THREE.CircleGeometry(0.308, 28);
  keyFaceDiscGeo.rotateX(-Math.PI / 2);

  // Invisible 1.42x radius hit cylinder so phone touch tapping is effortless and accurate
  const hitTargetGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.24, 16);
  const hitTargetMat = new THREE.MeshBasicMaterial({ visible: false });

  const flatBlackRimMat = new THREE.MeshStandardMaterial({
    color: 0x181716,
    roughness: 0.68,
    metalness: 0.05
  });

  const stemGeo = new THREE.CylinderGeometry(0.058, 0.058, 1.0, 12);
  const linkageGeo = new THREE.BoxGeometry(0.04, 0.05, 2.75);

  let barIndexCounter = 0;

  // 1. Build all 44 Printable Keys across 4 Staggered Rows
  KEY_ROWS.forEach((rowDef) => {
    const spacing = 0.72;
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

      // 1.4x larger invisible raycast target for easy mobile tapping
      const hitMesh = new THREE.Mesh(hitTargetGeo, hitTargetMat);
      hitMesh.position.y = 0.04;
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
      if (dist < 1.05) {
        k1.neighbors.push({ ctrl: k2, weight: Math.max(0.15, 1.0 - dist / 1.05) });
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

    const scaleX = sDef.isWide ? 1.28 : 1.0;

    const blackRim = new THREE.Mesh(bGeo, flatBlackRimMat);
    blackRim.scale.set(scaleX, 1, 1);
    blackRim.castShadow = true;
    keyGroup.add(blackRim);

    const topMat = createKeyTopMaterial(sDef.label, '', true);
    const faceDisc = new THREE.Mesh(dGeo, topMat);
    faceDisc.scale.set(scaleX, 1, 1);
    faceDisc.position.y = 0.067;
    keyGroup.add(faceDisc);

    const hitMesh = new THREE.Mesh(hitTargetGeo, hitTargetMat);
    hitMesh.scale.set(scaleX * 1.25, 1, 1.25);
    hitMesh.position.y = 0.04;
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

  // 3. Long Matte Dark Space Bar with Slightly Worn Edge
  const spaceGroup = new THREE.Group();
  spaceGroup.position.set(0, 0.56, 4.66);
  machineRoot.add(spaceGroup);

  const spaceBarGeo = new THREE.BoxGeometry(5.1, 0.16, 0.44);
  const spaceBarMat = createEnamelMaterial({
    baseColor: 0x222425,
    metalTint: 0x82888a,
    roughness: 0.65,
    metalness: 0.12
  });
  spaceBarMat.emissive = new THREE.Color(0xd99b52);
  spaceBarMat.emissiveIntensity = 0.0;

  const spaceBarMesh = new THREE.Mesh(spaceBarGeo, spaceBarMat);
  spaceBarMesh.castShadow = true;
  spaceBarMesh.receiveShadow = true;
  spaceGroup.add(spaceBarMesh);

  // Larger invisible hit box for the spacebar
  const spaceHitMesh = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.32, 0.72), hitTargetMat);
  spaceGroup.add(spaceHitMesh);

  const spaceArmLeft = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.62), chromeMat);
  spaceArmLeft.position.set(-2.25, -0.05, -0.28);
  spaceGroup.add(spaceArmLeft);

  const spaceArmRight = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.62), chromeMat);
  spaceArmRight.position.set(2.25, -0.05, -0.28);
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

  // Trigger a strong 3-4px equivalent sink (0.34 world units) + subtle warm highlight + neighbor ripple
  function depressKey(controller, depth = 0.34) {
    if (!controller) return;
    controller.pressDepth = depth;
    controller.pressVel = -1.1;
    if (controller.topMat) {
      controller.topMat.emissiveIntensity = 0.24;
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
        const targetGlow = Math.min(0.24, Math.max(0.0, (k.pressDepth / 0.34) * 0.22));
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
