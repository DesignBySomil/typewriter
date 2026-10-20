import * as THREE from 'three';
import { CONFIG } from './config.js';

function createImpactGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0.0, 'rgba(255, 244, 214, 0.90)');
  grad.addColorStop(0.32, 'rgba(238, 185, 108, 0.45)');
  grad.addColorStop(0.70, 'rgba(210, 130, 60, 0.12)');
  grad.addColorStop(1.0, 'rgba(210, 130, 60, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Builds the 44 Typebars in the Slotted Segment Basket:
 * - Dull brushed steel arms (roughness 0.44, NO neon rim glow)
 * - Darker oxidised steel slugs (roughness 0.58)
 * - Subtle impact flash at the printing point + 28-particle ink-dust puff
 */
export function buildTypebarsSystem(machineRoot, materials, printableControllers) {
  const { chromeMat } = materials;

  const typebasketGroup = new THREE.Group();
  typebasketGroup.position.set(0, 0, 0);
  machineRoot.add(typebasketGroup);

  // Slotted Satin-Nickel Segment Arc
  const segmentArcGeo = new THREE.TorusGeometry(2.05, 0.15, 12, 48, Math.PI * 0.78);
  const segmentMesh = new THREE.Mesh(segmentArcGeo, chromeMat);
  segmentMesh.position.set(0, 1.38, -0.58);
  segmentMesh.rotation.x = Math.PI * 0.46;
  segmentMesh.rotation.z = Math.PI * 0.11;
  typebasketGroup.add(segmentMesh);

  // Muted Felt Rest Pad Arc
  const restPadGeo = new THREE.TorusGeometry(2.62, 0.08, 10, 40, Math.PI * 0.76);
  const restPadMat = new THREE.MeshStandardMaterial({ color: 0x26382c, roughness: 0.92 });
  const restPadMesh = new THREE.Mesh(restPadGeo, restPadMat);
  restPadMesh.position.set(0, 1.42, -0.55);
  restPadMesh.rotation.x = Math.PI * 0.47;
  restPadMesh.rotation.z = Math.PI * 0.12;
  typebasketGroup.add(restPadMesh);

  const R = CONFIG.typebarRadius;
  const armGeo = new THREE.BoxGeometry(0.046, R + 0.16, 0.095);
  armGeo.translate(0, (R + 0.16) * 0.5, 0.02);

  const slugGeo = new THREE.BoxGeometry(0.115, 0.28, 0.16);
  slugGeo.translate(0, R + 0.12, -0.02);

  // Shared dull steel material for typebar arms (zero artificial neon emissive)
  const dullSteelArmMat = new THREE.MeshStandardMaterial({
    color: 0xaeb2b5,
    roughness: 0.44,
    metalness: 0.76,
    envMapIntensity: 0.55
  });

  const glowTex = createImpactGlowTexture();
  const totalBars = printableControllers.length; // 44 bars
  const bars = [];

  printableControllers.forEach((ctrl, idx) => {
    const normIdx = (idx / (totalBars - 1)) * 2 - 1; // -1 .. +1
    const fanAngle = normIdx * 1.10;

    const barHolder = new THREE.Group();
    barHolder.position.copy(CONFIG.strikePoint);
    barHolder.rotation.z = -fanAngle;

    const pivotNode = new THREE.Group();
    pivotNode.position.set(0, -R, 0);

    const restAngleX = 1.32;
    pivotNode.rotation.x = restAngleX;
    barHolder.add(pivotNode);

    const barArm = new THREE.Mesh(armGeo, dullSteelArmMat);
    barArm.castShadow = true;
    pivotNode.add(barArm);

    // Darker oxidised steel slug at the end of each bar
    const slugMat = new THREE.MeshStandardMaterial({
      color: 0x45484b,
      roughness: 0.58,
      metalness: 0.68,
      envMapIntensity: 0.45,
      emissive: new THREE.Color(0xffb454),
      emissiveIntensity: 0.0
    });
    const barSlug = new THREE.Mesh(slugGeo, slugMat);
    barSlug.castShadow = true;
    pivotNode.add(barSlug);

    // Subtle impact glint sprite at the slug tip
    const flashSpriteMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffd28e,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const flashSprite = new THREE.Sprite(flashSpriteMat);
    flashSprite.position.set(0, R + 0.18, 0.07);
    flashSprite.scale.set(0.45, 0.45, 0.45);
    pivotNode.add(flashSprite);

    typebasketGroup.add(barHolder);

    const barState = {
      index: idx,
      normIdx,
      pivotNode,
      slugMat,
      flashSpriteMat,
      restAngleX,
      phase: 'idle',
      timer: 0,
      flashIntensity: 0
    };

    ctrl.typebar = barState;
    bars.push(barState);
  });

  // Ink-Dust Puff Particle System (28 micro-particles bursting off the ribbon/paper at impact)
  const dustCount = 28;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustVelocities = Array.from({ length: dustCount }, () => new THREE.Vector3());
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

  const dustMat = new THREE.PointsMaterial({
    color: 0xd0bda0,
    size: 0.048,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  machineRoot.add(dustPoints);

  let dustLife = 0.0;

  function triggerInkDustPuff(ribbonColor = 'black') {
    dustLife = 1.0;
    dustMat.color.setHex(ribbonColor === 'red' ? 0xd9534f : 0xe8d5b7);
    dustMat.opacity = 0.65;

    const posAttr = dustGeo.attributes.position;
    for (let i = 0; i < dustCount; i++) {
      posAttr.setXYZ(
        i,
        CONFIG.strikePoint.x + (Math.random() - 0.5) * 0.12,
        CONFIG.strikePoint.y + 0.14 + (Math.random() - 0.5) * 0.08,
        CONFIG.strikePoint.z + 0.06
      );
      dustVelocities[i].set(
        (Math.random() - 0.5) * 1.2,
        0.4 + Math.random() * 1.15,
        0.3 + Math.random() * 0.9
      );
    }
    posAttr.needsUpdate = true;
  }

  let basketTargetY = 0;

  function triggerBarSwing(ctrl, isJammed = false, onVisualImpact = null) {
    if (!ctrl || !ctrl.typebar) return;
    const b = ctrl.typebar;
    b.timer = 0;
    b.onVisualImpact = onVisualImpact;
    b.didTriggerImpact = false;
    b.phase = isJammed ? 'jam' : 'anticipation';
  }

  function setBasketShift(isShifted) {
    basketTargetY = isShifted ? -0.15 : 0.0;
  }

  function updateTypebars(dt) {
    typebasketGroup.position.y += (basketTargetY - typebasketGroup.position.y) * Math.min(1.0, dt * 18.0);

    // Update Ink-Dust Puff Particles
    if (dustLife > 0.001) {
      dustLife = Math.max(0.0, dustLife - dt * 4.2);
      dustMat.opacity = dustLife * 0.65;
      const posAttr = dustGeo.attributes.position;
      for (let i = 0; i < dustCount; i++) {
        posAttr.setXYZ(
          i,
          posAttr.getX(i) + dustVelocities[i].x * dt,
          posAttr.getY(i) + dustVelocities[i].y * dt,
          posAttr.getZ(i) + dustVelocities[i].z * dt
        );
        dustVelocities[i].y -= 3.2 * dt;
        dustVelocities[i].multiplyScalar(Math.exp(-dt * 6.0));
      }
      posAttr.needsUpdate = true;
    } else if (dustMat.opacity !== 0) {
      dustMat.opacity = 0;
    }

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];

      // Subtle slug impact flash decay
      if (b.flashIntensity > 0.001) {
        b.flashIntensity *= Math.exp(-dt * 12.5);
        b.slugMat.emissiveIntensity = b.flashIntensity * 1.35;
        b.flashSpriteMat.opacity = Math.min(0.65, b.flashIntensity * 0.65);
      } else if (b.slugMat.emissiveIntensity !== 0) {
        b.slugMat.emissiveIntensity = 0;
        b.flashSpriteMat.opacity = 0;
      }

      if (b.phase === 'idle') continue;
      b.timer += dt;

      if (b.phase === 'anticipation') {
        const p = Math.min(1.0, b.timer / CONFIG.barAnticipationTime);
        b.pivotNode.rotation.x = b.restAngleX + Math.sin(p * Math.PI) * 0.06;
        if (p >= 1.0) {
          b.phase = 'up';
          b.timer = 0;
        }
      } else if (b.phase === 'up') {
        const p = Math.min(1.0, b.timer / CONFIG.barSwingUpTime);
        const eased = p * p * (3.0 - 2.0 * p);
        b.pivotNode.rotation.x = b.restAngleX * (1.0 - eased) - 0.015 * eased;

        if (p >= 1.0) {
          b.pivotNode.rotation.x = -0.015;
          b.flashIntensity = 1.0;
          b.slugMat.emissiveIntensity = 1.35;
          b.flashSpriteMat.opacity = 0.65;
          if (!b.didTriggerImpact && b.onVisualImpact) {
            b.didTriggerImpact = true;
            b.onVisualImpact();
          }
          b.phase = 'hold';
          b.timer = 0;
        }
      } else if (b.phase === 'hold') {
        const p = Math.min(1.0, b.timer / CONFIG.barImpactHoldTime);
        const microRebound = Math.sin(p * Math.PI) * 0.04;
        b.pivotNode.rotation.x = -0.01 + microRebound;

        if (b.timer >= CONFIG.barImpactHoldTime) {
          b.phase = 'rebound';
          b.timer = 0;
        }
      } else if (b.phase === 'rebound') {
        const p = Math.min(1.0, b.timer / CONFIG.barReboundTime);
        const easeOut = 1.0 - Math.pow(1.0 - p, 2.2);
        const padBounce = Math.sin(p * Math.PI * 2.0) * 0.05 * (1.0 - p);
        b.pivotNode.rotation.x = 0.03 + (b.restAngleX - 0.03) * easeOut - padBounce;

        if (p >= 1.0) {
          b.pivotNode.rotation.x = b.restAngleX;
          b.phase = 'idle';
        }
      } else if (b.phase === 'jam') {
        const jamDur = 0.17;
        const p = Math.min(1.0, b.timer / jamDur);
        const shake = Math.sin(p * Math.PI * 7.0) * 0.14 * (1.0 - p);
        const lift = Math.sin(p * Math.PI) * 0.58;
        b.pivotNode.rotation.x = b.restAngleX * (1.0 - lift) + shake;
        if (p >= 1.0) {
          b.pivotNode.rotation.x = b.restAngleX;
          b.phase = 'idle';
        }
      }
    }
  }

  return {
    typebasketGroup,
    bars,
    triggerBarSwing,
    triggerInkDustPuff,
    setBasketShift,
    updateTypebars
  };
}
