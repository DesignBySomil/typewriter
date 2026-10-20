import * as THREE from 'three';
import { CONFIG } from './config.js';

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

  // Bright polished chrome for the 44 typebars so motion reads clearly even in still frames
  const brightBarChromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.08,
    metalness: 0.85,
    emissive: new THREE.Color(0x1a1917),
    emissiveIntensity: 0.35
  });

  const R = CONFIG.typebarRadius;
  const armGeo = new THREE.BoxGeometry(0.036, R, 0.085);
  armGeo.translate(0, R * 0.5, 0);

  const slugGeo = new THREE.BoxGeometry(0.095, 0.24, 0.14);
  slugGeo.translate(0, R - 0.03, -0.045);

  const totalBars = printableControllers.length; // 44 bars
  const bars = [];

  printableControllers.forEach((ctrl, idx) => {
    const normIdx = (idx / (totalBars - 1)) * 2 - 1; // -1 .. +1
    const fanAngle = normIdx * 1.12; // radians across the segment arc

    // Center holder at the exact platen printing point
    const barHolder = new THREE.Group();
    barHolder.position.copy(CONFIG.strikePoint);
    barHolder.rotation.z = -fanAngle;

    const pivotNode = new THREE.Group();
    pivotNode.position.set(0, -R, 0);

    // Rest angle: lying back in the basket pad (~78 deg forward tilt)
    const restAngleX = 1.36;
    pivotNode.rotation.x = restAngleX;
    barHolder.add(pivotNode);

    const barArm = new THREE.Mesh(armGeo, brightBarChromeMat);
    barArm.castShadow = true;
    pivotNode.add(barArm);

    // Each slug has its own material instance so it can emit a bright impact flash
    const slugMat = new THREE.MeshStandardMaterial({
      color: 0xf4f0e8,
      roughness: 0.15,
      metalness: 0.82,
      emissive: new THREE.Color(0xffb054),
      emissiveIntensity: 0.0
    });
    const barSlug = new THREE.Mesh(slugGeo, slugMat);
    barSlug.castShadow = true;
    pivotNode.add(barSlug);

    typebasketGroup.add(barHolder);

    const barState = {
      index: idx,
      pivotNode,
      slugMat,
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

    if (isJammed) {
      b.phase = 'jam';
    } else {
      b.phase = 'anticipation';
    }
  }

  function setBasketShift(isShifted) {
    basketTargetY = isShifted ? -0.16 : 0.0;
  }

  function updateTypebars(dt, elapsedTotal) {
    // Subtle idle breathing shimmer on basket shift position
    const idleBreath = Math.sin(elapsedTotal * 1.8) * 0.004;
    typebasketGroup.position.y += ((basketTargetY + idleBreath) - typebasketGroup.position.y) * Math.min(1.0, dt * 18.0);

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];

      // Decay slug impact emissive flash
      if (b.flashIntensity > 0.001) {
        b.flashIntensity *= Math.exp(-dt * 18.0);
        b.slugMat.emissiveIntensity = b.flashIntensity;
      } else if (b.slugMat.emissiveIntensity !== 0) {
        b.slugMat.emissiveIntensity = 0;
      }

      if (b.phase === 'idle') continue;
      b.timer += dt;

      if (b.phase === 'anticipation') {
        // Brief 14ms dip into the basket pad before snapping upward
        const p = Math.min(1.0, b.timer / CONFIG.barAnticipationTime);
        b.pivotNode.rotation.x = b.restAngleX + Math.sin(p * Math.PI) * 0.07;
        if (p >= 1.0) {
          b.phase = 'up';
          b.timer = 0;
        }
      } else if (b.phase === 'up') {
        // Fast accelerated swing to the printing point (angle = -0.02 slight overshoot into platen)
        const p = Math.min(1.0, b.timer / CONFIG.barSwingUpTime);
        const eased = p * p * (3.0 - 2.0 * p);
        b.pivotNode.rotation.x = b.restAngleX * (1.0 - eased) - 0.025 * eased;

        if (p >= 1.0) {
          b.pivotNode.rotation.x = -0.02;
          b.flashIntensity = 2.6; // Bright metallic impact flash on the slug!
          b.slugMat.emissiveIntensity = 2.6;
          if (!b.didTriggerImpact && b.onVisualImpact) {
            b.didTriggerImpact = true;
            b.onVisualImpact();
          }
          b.phase = 'hold';
          b.timer = 0;
        }
      } else if (b.phase === 'hold') {
        // Hold bar right at the printing point for ~62ms so still frames & human eyes clearly see the strike
        b.pivotNode.rotation.x = -0.015 + Math.sin(b.timer * 140.0) * 0.008;
        if (b.timer >= CONFIG.barImpactHoldTime) {
          b.phase = 'rebound';
          b.timer = 0;
        }
      } else if (b.phase === 'rebound') {
        // Rebound off platen and settle into velvet rest pad with tiny bounce
        const p = Math.min(1.0, b.timer / CONFIG.barReboundTime);
        const easeOut = 1.0 - Math.pow(1.0 - p, 2.4);
        const padBounce = Math.sin(p * Math.PI * 2.0) * 0.05 * (1.0 - p);
        b.pivotNode.rotation.x = b.restAngleX * easeOut - padBounce;

        if (p >= 1.0) {
          b.pivotNode.rotation.x = b.restAngleX;
          b.phase = 'idle';
        }
      } else if (b.phase === 'jam') {
        // Margin lock jam: bar swings halfway up, shudders, and falls back
        const jamDur = 0.16;
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
