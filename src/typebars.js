import * as THREE from 'three';
import { CONFIG } from './config.js';

/**
 * Creates a radial soft glow texture for the additive slug impact bloom sprite
 */
function createImpactGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0.0, 'rgba(255, 250, 225, 1.0)');
  grad.addColorStop(0.28, 'rgba(255, 195, 105, 0.82)');
  grad.addColorStop(0.65, 'rgba(232, 130, 50, 0.25)');
  grad.addColorStop(1.0, 'rgba(232, 130, 50, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function buildTypebarsSystem(machineRoot, materials, printableControllers) {
  const { chromeMat } = materials;

  const typebasketGroup = new THREE.Group();
  typebasketGroup.position.set(0, 0, 0);
  machineRoot.add(typebasketGroup);

  // Slotted Steel Segment Arc
  const segmentArcGeo = new THREE.TorusGeometry(2.15, 0.16, 12, 48, Math.PI * 0.78);
  const segmentMesh = new THREE.Mesh(segmentArcGeo, chromeMat);
  segmentMesh.position.set(0, 1.55, -0.58);
  segmentMesh.rotation.x = Math.PI * 0.46;
  segmentMesh.rotation.z = Math.PI * 0.11;
  typebasketGroup.add(segmentMesh);

  // Green Velvet Rest Pad Arc
  const restPadGeo = new THREE.TorusGeometry(2.75, 0.09, 10, 40, Math.PI * 0.76);
  const restPadMat = new THREE.MeshStandardMaterial({ color: 0x1b4d32, roughness: 0.88 });
  const restPadMesh = new THREE.Mesh(restPadGeo, restPadMat);
  restPadMesh.position.set(0, 1.58, -0.55);
  restPadMesh.rotation.x = Math.PI * 0.47;
  restPadMesh.rotation.z = Math.PI * 0.12;
  typebasketGroup.add(restPadMesh);

  const R = CONFIG.typebarRadius;
  const armGeo = new THREE.BoxGeometry(0.044, R, 0.092);
  armGeo.translate(0, R * 0.5, 0);

  const slugGeo = new THREE.BoxGeometry(0.11, 0.26, 0.15);
  slugGeo.translate(0, R - 0.02, -0.045);

  const glowTex = createImpactGlowTexture();
  const totalBars = printableControllers.length; // 44 bars
  const bars = [];

  printableControllers.forEach((ctrl, idx) => {
    const normIdx = (idx / (totalBars - 1)) * 2 - 1; // -1 .. +1
    const fanAngle = normIdx * 1.12; // radians across the segment arc

    const barHolder = new THREE.Group();
    barHolder.position.copy(CONFIG.strikePoint);
    barHolder.rotation.z = -fanAngle;

    const pivotNode = new THREE.Group();
    pivotNode.position.set(0, -R, 0);

    // Rest angle: lying cleanly in the radial basket fan
    const restAngleX = 1.34;
    pivotNode.rotation.x = restAngleX;
    barHolder.add(pivotNode);

    // Individual arm material so a gentle light sweep can travel across the resting fan
    const armMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.07,
      metalness: 0.88,
      emissive: new THREE.Color(0x28241e),
      emissiveIntensity: 0.42
    });
    const barArm = new THREE.Mesh(armGeo, armMat);
    barArm.castShadow = true;
    pivotNode.add(barArm);

    const slugMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.12,
      metalness: 0.85,
      emissive: new THREE.Color(0xffb85c),
      emissiveIntensity: 0.0
    });
    const barSlug = new THREE.Mesh(slugGeo, slugMat);
    barSlug.castShadow = true;
    pivotNode.add(barSlug);

    // Additive bloom sprite attached right to the slug tip so impact flashes unmistakably in still frames
    const flashSpriteMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffd28a,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const flashSprite = new THREE.Sprite(flashSpriteMat);
    flashSprite.position.set(0, R + 0.04, 0.05);
    flashSprite.scale.set(0.65, 0.65, 0.65);
    pivotNode.add(flashSprite);

    typebasketGroup.add(barHolder);

    const barState = {
      index: idx,
      normIdx,
      pivotNode,
      armMat,
      slugMat,
      flashSpriteMat,
      restAngleX,
      phase: 'idle', // 'idle' | 'anticipation' | 'up' | 'hold' | 'rebound' | 'jam'
      timer: 0,
      flashIntensity: 0
    };

    ctrl.typebar = barState;
    bars.push(barState);
  });

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
    basketTargetY = isShifted ? -0.16 : 0.0;
  }

  function updateTypebars(dt, elapsedTotal) {
    const idleBreath = Math.sin(elapsedTotal * 1.8) * 0.004;
    typebasketGroup.position.y += ((basketTargetY + idleBreath) - typebasketGroup.position.y) * Math.min(1.0, dt * 18.0);

    // Gentle light sweep across the 44 chrome typebars in the basket fan
    const sweepCenter = Math.sin(elapsedTotal * 1.15);

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];

      // Update idle light sweep shimmer on arm
      const distFromSweep = Math.abs(b.normIdx - sweepCenter);
      const sweepBoost = Math.max(0.0, 1.0 - distFromSweep * 2.2);
      const activeBoost = b.phase !== 'idle' ? 0.85 : 0.0;
      b.armMat.emissiveIntensity = 0.32 + sweepBoost * 0.45 + activeBoost;

      // Decay slug impact emissive flash & bloom sprite
      if (b.flashIntensity > 0.001) {
        b.flashIntensity *= Math.exp(-dt * 12.5);
        b.slugMat.emissiveIntensity = b.flashIntensity * 3.2;
        b.flashSpriteMat.opacity = Math.min(1.0, b.flashIntensity * 1.15);
      } else if (b.slugMat.emissiveIntensity !== 0) {
        b.slugMat.emissiveIntensity = 0;
        b.flashSpriteMat.opacity = 0;
      }

      if (b.phase === 'idle') continue;
      b.timer += dt;

      if (b.phase === 'anticipation') {
        const p = Math.min(1.0, b.timer / CONFIG.barAnticipationTime);
        b.pivotNode.rotation.x = b.restAngleX + Math.sin(p * Math.PI) * 0.07;
        if (p >= 1.0) {
          b.phase = 'up';
          b.timer = 0;
        }
      } else if (b.phase === 'up') {
        const p = Math.min(1.0, b.timer / CONFIG.barSwingUpTime);
        const eased = p * p * (3.0 - 2.0 * p);
        b.pivotNode.rotation.x = b.restAngleX * (1.0 - eased) - 0.025 * eased;

        if (p >= 1.0) {
          b.pivotNode.rotation.x = -0.025;
          b.flashIntensity = 1.0;
          b.slugMat.emissiveIntensity = 3.2;
          b.flashSpriteMat.opacity = 0.95;
          if (!b.didTriggerImpact && b.onVisualImpact) {
            b.didTriggerImpact = true;
            b.onVisualImpact();
          }
          b.phase = 'hold';
          b.timer = 0;
        }
      } else if (b.phase === 'hold') {
        // Tiny rebound off platen during the 85ms impact hold so bar + flash are unmistakable
        const p = Math.min(1.0, b.timer / CONFIG.barImpactHoldTime);
        const platenRebound = Math.sin(p * Math.PI) * 0.085;
        b.pivotNode.rotation.x = -0.02 + platenRebound;

        if (b.timer >= CONFIG.barImpactHoldTime) {
          b.phase = 'rebound';
          b.timer = 0;
        }
      } else if (b.phase === 'rebound') {
        // Slightly slower return to the velvet rest pad with a soft settle bounce
        const p = Math.min(1.0, b.timer / CONFIG.barReboundTime);
        const easeOut = 1.0 - Math.pow(1.0 - p, 2.2);
        const padBounce = Math.sin(p * Math.PI * 2.0) * 0.055 * (1.0 - p);
        b.pivotNode.rotation.x = 0.06 + (b.restAngleX - 0.06) * easeOut - padBounce;

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
    setBasketShift,
    updateTypebars
  };
}
