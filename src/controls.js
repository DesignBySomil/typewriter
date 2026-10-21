import * as THREE from 'three';
import { CONFIG } from './config.js';

function createPullToastElement() {
  let el = document.getElementById('pull-sheet-toast');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'pull-sheet-toast';
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    top: '18%',
    transform: 'translate(-50%, -8px)',
    zIndex: '9',
    padding: '6px 14px',
    background: 'rgba(12, 11, 10, 0.88)',
    border: '1px solid rgba(216, 175, 114, 0.78)',
    color: '#fff6e8',
    fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
    fontSize: '10.5px',
    fontWeight: 'bold',
    letterSpacing: '1.8px',
    textTransform: 'uppercase',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.16s ease, transform 0.16s ease',
    boxShadow: '0 6px 20px rgba(0,0,0,0.55)',
    whiteSpace: 'nowrap'
  });
  el.textContent = '↑ PULL UP TO REMOVE';
  document.body.appendChild(el);
  return el;
}

export function createControlsSystem({
  rendererDom,
  camera,
  chassis,
  keysSys,
  carriageSys,
  paperSys,
  onPrintableKey,
  onSpace,
  onBackspace,
  onCarriageReturn,
  onShiftToggleLock,
  onCycleRibbonMode,
  onPlatenLineFeed,
  onPlatenSnapLine,
  onCarriageSlideContinuous,
  onCarriageSlideSnap,
  onUpdateMargins,
  onTogglePaperRelease,
  onRemoveOrInsertPaper,
  onTouchCanvasFocus
}) {
  const controlMeshes = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const pullToast = createPullToastElement();

  function showPullToast(visible) {
    if (!pullToast) return;
    pullToast.style.opacity = visible ? '1' : '0';
    pullToast.style.transform = visible ? 'translate(-50%, 0)' : 'translate(-50%, -8px)';
  }

  function registerControlMesh(mesh, controlId, extraData = {}) {
    mesh.userData.controlId = controlId;
    Object.assign(mesh.userData, extraData);
    controlMeshes.push(mesh);
  }

  function registerGroupChildren(group, controlId, extraData = {}) {
    if (!group) return;
    group.traverse((child) => {
      if (child.isMesh) {
        registerControlMesh(child, controlId, extraData);
      }
    });
  }

  // 1 & 2. Register all 3D keys
  keysSys.clickableMeshes.forEach((m) => {
    const ctrl = m.userData.keyController;
    if (!ctrl) return;
    if (ctrl.code === 'Enter' && ctrl.label === 'RETURN LEVER') return;
    registerControlMesh(m, `key:${ctrl.code}`, { keyController: ctrl });
  });

  // 3. Carriage Return Lever (shrunk & offset forward away from left knob center, >=44px on 390px phone)
  registerGroupChildren(carriageSys.returnLeverGroup, 'carriageReturnLever');
  const crHit = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 1.35), hitMat);
  crHit.position.set(0.28, 0.08, 1.25);
  carriageSys.returnLeverGroup.add(crHit);
  registerControlMesh(crHit, 'carriageReturnLever');

  // 4. Left & Right Platen Knobs (priority 0: wins over every other control; offset slightly outward)
  registerGroupChildren(carriageSys.leftKnob, 'platenKnobLeft');
  registerGroupChildren(carriageSys.rightKnob, 'platenKnobRight');

  const knobHitGeo = new THREE.CylinderGeometry(0.95, 0.95, 1.05, 20);
  knobHitGeo.rotateZ(Math.PI / 2);

  const leftKnobHit = new THREE.Mesh(knobHitGeo, hitMat);
  leftKnobHit.position.x = -0.18;
  carriageSys.leftKnob.add(leftKnobHit);
  registerControlMesh(leftKnobHit, 'platenKnobLeft');

  const rightKnobHit = new THREE.Mesh(knobHitGeo, hitMat);
  rightKnobHit.position.x = 0.18;
  carriageSys.rightKnob.add(rightKnobHit);
  registerControlMesh(rightKnobHit, 'platenKnobRight');

  // 5. Ribbon Colour Switch Lever on the right top cover
  registerGroupChildren(chassis.ribbonSelectorBase, 'ribbonSwitchLever');
  const ribSelHit = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.85), hitMat);
  ribSelHit.position.set(0, 0.12, 0.08);
  chassis.ribbonSelectorBase.add(ribSelHit);
  registerControlMesh(ribSelHit, 'ribbonSwitchLever');

  // 6. Left & Right Margin Stop Sliders on the scale rail
  registerGroupChildren(carriageSys.leftMarginStopGroup, 'marginStopLeft');
  registerGroupChildren(carriageSys.rightMarginStopGroup, 'marginStopRight');

  const marginStopHitGeo = new THREE.BoxGeometry(0.85, 0.78, 0.78);
  const leftStopHit = new THREE.Mesh(marginStopHitGeo, hitMat);
  leftStopHit.position.set(0, 0.15, 0);
  carriageSys.leftMarginStopGroup.add(leftStopHit);
  registerControlMesh(leftStopHit, 'marginStopLeft');

  const rightStopHit = new THREE.Mesh(marginStopHitGeo, hitMat);
  rightStopHit.position.set(0, 0.15, 0);
  carriageSys.rightMarginStopGroup.add(rightStopHit);
  registerControlMesh(rightStopHit, 'marginStopRight');

  // 7. Paper Release Lever on the right side of the carriage (shrunk & offset inward/upward away from right knob)
  registerGroupChildren(carriageSys.paperReleaseLeverGroup, 'paperReleaseLever');
  const prLeverHit = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.58, 0.58), hitMat);
  prLeverHit.position.set(-0.18, 0.36, 0.18);
  carriageSys.paperReleaseLeverGroup.add(prLeverHit);
  registerControlMesh(prLeverHit, 'paperReleaseLever');

  // 8. Full-Length Platen Roller Hit Cylinder, Slimmed Paper Sheet Hit Box, and Carriage Body Hit Meshes
  const platenHitGeo = new THREE.CylinderGeometry(CONFIG.platenRadius * 1.55, CONFIG.platenRadius * 1.55, CONFIG.platenLength - 0.3, 20);
  platenHitGeo.rotateZ(Math.PI / 2);
  const platenHitMesh = new THREE.Mesh(platenHitGeo, hitMat);
  carriageSys.platenRollerGroup.add(platenHitMesh);
  registerControlMesh(platenHitMesh, 'platenRoller');
  registerControlMesh(carriageSys.platenMesh, 'platenRoller');

  // Slimmed depth (0.36 instead of 1.35) so paperHitBox hugs the visible sheet without overhanging the scale rail
  const paperHitBox = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.paperWidth + 0.2, CONFIG.paperSheetHeight + 0.5, 0.36),
    hitMat
  );
  paperHitBox.position.set(0, 1.72, -0.08);
  paperHitBox.rotation.x = -0.21;
  carriageSys.carriageGroup.add(paperHitBox);
  registerControlMesh(paperSys.paperMesh, 'paperSheet');
  registerControlMesh(paperHitBox, 'paperSheet');

  if (carriageSys.leftCarriagePlate) registerControlMesh(carriageSys.leftCarriagePlate, 'carriageBody');
  if (carriageSys.rightCarriagePlate) registerControlMesh(carriageSys.rightCarriagePlate, 'carriageBody');
  if (carriageSys.paperTableMesh) registerControlMesh(carriageSys.paperTableMesh, 'carriageBody');

  const carriageBodyHit = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.platenLength - 0.2, 1.35, 1.55),
    hitMat
  );
  carriageBodyHit.position.set(0, 0.25, -0.20);
  carriageSys.carriageGroup.add(carriageBodyHit);
  registerControlMesh(carriageBodyHit, 'carriageBody');

  function getControlPriority(cid) {
    if (cid === 'platenKnobLeft' || cid === 'platenKnobRight') return 0;
    if (cid === 'marginStopLeft' || cid === 'marginStopRight') return 1;
    if (
      cid === 'carriageReturnLever' ||
      cid === 'paperReleaseLever' ||
      cid === 'ribbonSwitchLever'
    ) return 2;
    if (cid.startsWith('key:')) return 3;
    if (cid === 'paperSheet') return 4;
    if (cid === 'platenRoller') return 5;
    if (cid === 'carriageBody') return 6;
    return 7;
  }

  function isGrabbableControl(cid) {
    return (
      cid === 'platenKnobLeft' ||
      cid === 'platenKnobRight' ||
      cid === 'platenRoller' ||
      cid === 'paperSheet' ||
      cid === 'carriageBody' ||
      cid === 'carriageReturnLever' ||
      cid === 'marginStopLeft' ||
      cid === 'marginStopRight'
    );
  }

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let activeDrag = null;

  function updatePointerNDC(e) {
    const rect = rendererDom.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickControl(e) {
    updatePointerNDC(e);
    raycaster.setFromCamera(pointerNDC, camera);
    const rawHits = raycaster.intersectObjects(controlMeshes, false);
    if (rawHits.length === 0) return null;

    const validHits = [];
    for (let i = 0; i < rawHits.length; i++) {
      const h = rawHits[i];
      const cid = h.object.userData.controlId;
      if (!cid) continue;
      if (cid === 'paperSheet' && !paperSys.isSheetPresent()) continue;
      validHits.push(h);
    }
    if (validHits.length === 0) return null;

    // 1. Platen knobs anywhere in validHits win first (nearest first since raycaster sorts by distance)
    for (let i = 0; i < validHits.length; i++) {
      const cid = validHits[i].object.userData.controlId;
      if (cid === 'platenKnobLeft' || cid === 'platenKnobRight') {
        return validHits[i];
      }
    }

    // 2. Margin stops anywhere in validHits win next (nearest first)
    for (let i = 0; i < validHits.length; i++) {
      const cid = validHits[i].object.userData.controlId;
      if (cid === 'marginStopLeft' || cid === 'marginStopRight') {
        return validHits[i];
      }
    }

    // 3. Levers (carriageReturnLever, paperReleaseLever, ribbonSwitchLever) anywhere in validHits win next (nearest first)
    for (let i = 0; i < validHits.length; i++) {
      const cid = validHits[i].object.userData.controlId;
      if (
        cid === 'carriageReturnLever' ||
        cid === 'paperReleaseLever' ||
        cid === 'ribbonSwitchLever'
      ) {
        return validHits[i];
      }
    }

    // 4. Fallback: among hits within 0.15 world units of the nearest hit, prefer lowest priority number, tie-break by distance
    const minDistance = validHits[0].distance;
    let bestHit = validHits[0];
    let bestPrio = getControlPriority(bestHit.object.userData.controlId);

    for (let i = 1; i < validHits.length; i++) {
      const h = validHits[i];
      if (h.distance <= minDistance + 0.15) {
        const prio = getControlPriority(h.object.userData.controlId);
        if (prio < bestPrio || (prio === bestPrio && h.distance < bestHit.distance)) {
          bestPrio = prio;
          bestHit = h;
        }
      }
    }
    return bestHit;
  }

  function clearHoldTimer(drag) {
    if (drag && drag.holdTimer) {
      clearTimeout(drag.holdTimer);
      drag.holdTimer = null;
    }
  }

  rendererDom.addEventListener('pointermove', (e) => {
    if (activeDrag && activeDrag.pointerId === e.pointerId) {
      handleDragMove(e);
      return;
    }

    if (e.pointerType === 'mouse') {
      const hit = pickControl(e);
      if (!hit) {
        rendererDom.style.cursor = 'default';
        return;
      }
      const cid = hit.object.userData.controlId;
      rendererDom.style.cursor = isGrabbableControl(cid) ? 'grab' : 'pointer';
    }
  });

  rendererDom.addEventListener('pointerdown', (e) => {
    const hit = pickControl(e);
    if (!hit) {
      if (e.pointerType === 'touch' && onTouchCanvasFocus) {
        onTouchCanvasFocus();
      }
      return;
    }

    const cid = hit.object.userData.controlId;
    try {
      rendererDom.setPointerCapture(e.pointerId);
    } catch (_) {}

    if (e.pointerType === 'mouse' && isGrabbableControl(cid)) {
      rendererDom.style.cursor = 'grabbing';
    }

    activeDrag = {
      pointerId: e.pointerId,
      controlId: cid,
      hitObject: hit.object,
      hitPointWorld: hit.point.clone(),
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      downTime: performance.now(),
      totalDist: 0,
      gestureMode: null,
      pullArmed: carriageSys.state.paperReleased,
      pullRatio: 0,
      holdTimer: null,
      didTriggerAction: false
    };

    if (cid === 'paperSheet' && paperSys.isSheetPresent()) {
      if (carriageSys.state.paperReleased) {
        showPullToast(true);
      } else {
        activeDrag.holdTimer = setTimeout(() => {
          if (activeDrag && activeDrag.controlId === 'paperSheet' && !activeDrag.gestureMode && activeDrag.totalDist < 12) {
            activeDrag.pullArmed = true;
            showPullToast(true);
          }
        }, 250);
      }
    }

    if (cid.startsWith('key:')) {
      const ctrl = hit.object.userData.keyController;
      if (!ctrl) return;
      if (ctrl.code === 'Space') {
        onSpace();
      } else if (ctrl.code === 'Enter') {
        onCarriageReturn();
      } else if (ctrl.code === 'Backspace') {
        onBackspace();
      } else if (ctrl.code === 'Tab') {
        onCycleRibbonMode();
      } else if (ctrl.code === 'ShiftLeft' || ctrl.code === 'ShiftRight') {
        onShiftToggleLock();
      } else {
        onPrintableKey(ctrl, null);
      }
      activeDrag.didTriggerAction = true;
    } else if (cid === 'ribbonSwitchLever') {
      onCycleRibbonMode();
      activeDrag.didTriggerAction = true;
    } else if (cid === 'paperReleaseLever') {
      onTogglePaperRelease();
      activeDrag.didTriggerAction = true;
    } else if (cid === 'platenRoller' && !paperSys.isSheetPresent()) {
      onRemoveOrInsertPaper('insert');
      activeDrag.didTriggerAction = true;
    }
  });

  function handleDragMove(e) {
    if (!activeDrag) return;
    const dx = e.clientX - activeDrag.lastX;
    const dy = e.clientY - activeDrag.lastY;
    activeDrag.lastX = e.clientX;
    activeDrag.lastY = e.clientY;
    activeDrag.totalDist += Math.hypot(dx, dy);

    const totalDx = e.clientX - activeDrag.startX;
    const totalDy = e.clientY - activeDrag.startY;
    const cid = activeDrag.controlId;

    // 1. Platen Knobs & Platen Roller: 1:1 continuous rotation (~26px per line) + continuous paper scroll
    if (cid === 'platenKnobLeft' || cid === 'platenKnobRight' || cid === 'platenRoller') {
      if (cid === 'platenRoller' && !paperSys.isSheetPresent()) {
        if (activeDrag.totalDist > 10 && !activeDrag.didTriggerAction) {
          activeDrag.didTriggerAction = true;
          onRemoveOrInsertPaper('insert');
        }
        return;
      }

      if (cid === 'platenRoller' && !activeDrag.gestureMode && activeDrag.totalDist > 6) {
        activeDrag.gestureMode = Math.abs(totalDx) > Math.abs(totalDy) * 1.25 ? 'slide' : 'roll';
      }

      if (activeDrag.gestureMode === 'slide') {
        onCarriageSlideContinuous(dx);
        activeDrag.didTriggerAction = true;
      } else if (Math.abs(dy) > 0) {
        const deltaLines = -dy / 26.0;
        onPlatenLineFeed(deltaLines, false);
        activeDrag.didTriggerAction = true;
      }
      return;
    }

    // 2. Carriage Body: continuous horizontal carriage slide
    if (cid === 'carriageBody') {
      if (activeDrag.totalDist > 2) {
        onCarriageSlideContinuous(dx);
        activeDrag.didTriggerAction = true;
      }
      return;
    }

    // 3 & 4. Paper Sheet Gestures
    if (cid === 'paperSheet') {
      if (!activeDrag.gestureMode && activeDrag.totalDist > 7) {
        clearHoldTimer(activeDrag);
        const heldMs = performance.now() - activeDrag.downTime;
        if (Math.abs(totalDx) > Math.abs(totalDy) * 1.15) {
          activeDrag.gestureMode = 'slide';
          showPullToast(false);
        } else {
          const isPullUp = totalDy < 0 && (carriageSys.state.paperReleased || activeDrag.pullArmed || heldMs >= 250);
          activeDrag.gestureMode = isPullUp ? 'pullOut' : 'roll';
          if (isPullUp) showPullToast(true);
        }
      }

      if (
        activeDrag.gestureMode === 'roll' &&
        (performance.now() - activeDrag.downTime) >= 250 &&
        totalDy < -40 &&
        activeDrag.pullArmed
      ) {
        activeDrag.gestureMode = 'pullOut';
      }

      if (activeDrag.gestureMode === 'slide') {
        onCarriageSlideContinuous(dx);
        activeDrag.didTriggerAction = true;
      } else if (activeDrag.gestureMode === 'pullOut') {
        const pullPx = Math.max(0, -totalDy);
        const pullRatio = pullPx / 220.0;
        activeDrag.pullRatio = pullRatio;
        paperSys.setPullOutOffset(pullRatio);
        activeDrag.didTriggerAction = true;

        if (pullRatio >= 0.45 && paperSys.getSheetStatus() !== 'ejecting') {
          showPullToast(false);
          onRemoveOrInsertPaper('eject');
        }
      } else if (activeDrag.gestureMode === 'roll') {
        const deltaLines = -dy / 26.0;
        onPlatenLineFeed(deltaLines, false);
        activeDrag.didTriggerAction = true;
      }
      return;
    }

    // 5. Dragging Carriage Return Lever to the right
    if (cid === 'carriageReturnLever') {
      const rightDx = Math.max(0, totalDx);
      carriageSys.state.returnLeverDragSwing = Math.min(0.68, rightDx * 0.012);
      if (rightDx > 36 && !activeDrag.didTriggerAction) {
        activeDrag.didTriggerAction = true;
        onCarriageReturn();
      }
      return;
    }

    // 6. Dragging Margin Stops left/right along the scale rail
    if (cid === 'marginStopLeft' || cid === 'marginStopRight') {
      updatePointerNDC(e);
      raycaster.setFromCamera(pointerNDC, camera);
      const railNormal = new THREE.Vector3(0, 0, 1);
      const railPointWorld = new THREE.Vector3(0, 2.84 + 1.48, -1.16 - 1.04);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(railNormal, railPointWorld);
      const intersectPt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, intersectPt)) {
        const localX = intersectPt.x - carriageSys.carriageGroup.position.x;
        const draggedCol = carriageSys.localPaperXToCol(localX);
        onUpdateMargins(cid === 'marginStopLeft' ? 'left' : 'right', draggedCol);
        activeDrag.didTriggerAction = true;
      }
    }
  }

  function finishPointerInteraction(e) {
    if (!activeDrag || activeDrag.pointerId !== e.pointerId) return;
    clearHoldTimer(activeDrag);
    showPullToast(false);

    const cid = activeDrag.controlId;
    carriageSys.state.returnLeverDragSwing = 0;

    if (activeDrag.didTriggerAction) {
      if (
        cid === 'platenKnobLeft' ||
        cid === 'platenKnobRight' ||
        (cid === 'platenRoller' && activeDrag.gestureMode !== 'slide') ||
        (cid === 'paperSheet' && activeDrag.gestureMode === 'roll')
      ) {
        if (onPlatenSnapLine) onPlatenSnapLine();
      } else if (
        cid === 'carriageBody' ||
        activeDrag.gestureMode === 'slide'
      ) {
        if (onCarriageSlideSnap) onCarriageSlideSnap();
      } else if (cid === 'paperSheet' && activeDrag.gestureMode === 'pullOut') {
        if (activeDrag.pullRatio >= 0.25) {
          onRemoveOrInsertPaper('eject');
        } else {
          paperSys.settlePulledPaperBack();
        }
      }
    } else if (activeDrag.totalDist < 12) {
      if (cid === 'carriageReturnLever') {
        onCarriageReturn();
      } else if (cid === 'platenKnobLeft' || cid === 'platenKnobRight') {
        const knobCenterWorld = new THREE.Vector3();
        const knobObj = cid === 'platenKnobLeft' ? carriageSys.leftKnob : carriageSys.rightKnob;
        knobObj.getWorldPosition(knobCenterWorld);
        const dir = activeDrag.hitPointWorld.y >= knobCenterWorld.y ? 1 : -1;
        onPlatenLineFeed(dir, true);
      } else if (cid === 'paperSheet') {
        onRemoveOrInsertPaper('toggle');
      } else if (cid === 'platenRoller' && !paperSys.isSheetPresent()) {
        onRemoveOrInsertPaper('insert');
      }
    }

    if (e.pointerType === 'mouse') {
      const hit = pickControl(e);
      rendererDom.style.cursor = hit && isGrabbableControl(hit.object.userData.controlId) ? 'grab' : 'default';
    }

    try {
      rendererDom.releasePointerCapture(e.pointerId);
    } catch (_) {}
    activeDrag = null;
  }

  rendererDom.addEventListener('pointerup', finishPointerInteraction);
  rendererDom.addEventListener('pointercancel', finishPointerInteraction);

  return {
    controlMeshes
  };
}
