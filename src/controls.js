import * as THREE from 'three';
import { CONFIG } from './config.js';

/**
 * Creates a small non-intrusive HUD toast element for "PULL UP TO REMOVE" feedback when holding the paper
 */
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

/**
 * Continuous, tactile 3D hardware controls on both Desktop Mouse and Phone Touch:
 * 1. Platen knobs & full-length platen roller: 1:1 continuous vertical drag (fractional lines, no 22px notches),
 *    easing to the nearest line with a ratchet click on release.
 * 2. Carriage slide: continuous horizontal drag on the paper or carriage body, clamped between active
 *    margin stops, with ratchet clicks per column and snap to nearest column on release.
 * 3. Paper pull-out: upward drag on the paper when Paper Release is ON, OR after a 250ms hold ("PULL UP TO REMOVE").
 *    Sheet follows finger up 1:1; if pulled past 25% of its height it flies out (archived for PRINT/SAVE),
 *    otherwise it settles back into place. Tapping/dragging the empty platen inserts a fresh sheet.
 * 4. Generous hit areas (knob hit radius 1.2, full platen roller, full paper sheet, carriage body) + grab/grabbing cursors.
 */
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

  // 1 & 2. Register all 3D keys
  keysSys.clickableMeshes.forEach((m) => {
    const ctrl = m.userData.keyController;
    if (!ctrl) return;
    if (ctrl.code === 'Enter' && ctrl.label === 'RETURN LEVER') return;
    registerControlMesh(m, `key:${ctrl.code}`, { keyController: ctrl });
  });

  // 3. Carriage Return Lever (enlarged hit box)
  const crHit = new THREE.Mesh(new THREE.BoxGeometry(1.30, 1.0, 2.35), hitMat);
  crHit.position.set(0.10, 0.12, 0.95);
  carriageSys.returnLeverGroup.add(crHit);
  registerControlMesh(crHit, 'carriageReturnLever');

  // 4. Left & Right Platen Knobs (generous hit radius 1.2 for effortless phone thumb grab)
  const knobHitGeo = new THREE.CylinderGeometry(1.20, 1.20, 1.25, 20);
  knobHitGeo.rotateZ(Math.PI / 2);

  const leftKnobHit = new THREE.Mesh(knobHitGeo, hitMat);
  carriageSys.leftKnob.add(leftKnobHit);
  registerControlMesh(leftKnobHit, 'platenKnobLeft');

  const rightKnobHit = new THREE.Mesh(knobHitGeo, hitMat);
  carriageSys.rightKnob.add(rightKnobHit);
  registerControlMesh(rightKnobHit, 'platenKnobRight');

  // 5. Ribbon Colour Switch Lever on the right top cover
  const ribSelHit = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.75, 1.05), hitMat);
  ribSelHit.position.set(0, 0.12, 0.08);
  chassis.ribbonSelectorBase.add(ribSelHit);
  registerControlMesh(ribSelHit, 'ribbonSwitchLever');

  // 6. Left & Right Margin Stop Sliders on the scale rail
  const marginStopHitGeo = new THREE.BoxGeometry(1.10, 0.95, 0.95);
  const leftStopHit = new THREE.Mesh(marginStopHitGeo, hitMat);
  leftStopHit.position.set(0, 0.15, 0);
  carriageSys.leftMarginStopGroup.add(leftStopHit);
  registerControlMesh(leftStopHit, 'marginStopLeft');

  const rightStopHit = new THREE.Mesh(marginStopHitGeo, hitMat);
  rightStopHit.position.set(0, 0.15, 0);
  carriageSys.rightMarginStopGroup.add(rightStopHit);
  registerControlMesh(rightStopHit, 'marginStopRight');

  // 7. Paper Release Lever on the right side of the carriage
  const prLeverHit = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.05, 1.05), hitMat);
  prLeverHit.position.set(0.05, 0.22, 0.08);
  carriageSys.paperReleaseLeverGroup.add(prLeverHit);
  registerControlMesh(prLeverHit, 'paperReleaseLever');

  // 8. Full-Length Platen Roller Hit Cylinder, Full Paper Sheet Hit Box, and Carriage Body Hit Meshes
  const platenHitGeo = new THREE.CylinderGeometry(CONFIG.platenRadius * 1.65, CONFIG.platenRadius * 1.65, CONFIG.platenLength, 20);
  platenHitGeo.rotateZ(Math.PI / 2);
  const platenHitMesh = new THREE.Mesh(platenHitGeo, hitMat);
  carriageSys.platenRollerGroup.add(platenHitMesh);
  registerControlMesh(platenHitMesh, 'platenRoller');
  registerControlMesh(carriageSys.platenMesh, 'platenRoller');

  // Generous full-sheet hit volume covering the curved paper sheet
  const paperHitBox = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.paperWidth + 0.6, CONFIG.paperSheetHeight + 1.0, 1.5),
    hitMat
  );
  paperHitBox.position.set(0, 1.65, -0.35);
  paperHitBox.rotation.x = -0.21;
  carriageSys.carriageGroup.add(paperHitBox);
  registerControlMesh(paperSys.paperMesh, 'paperSheet');
  registerControlMesh(paperHitBox, 'paperSheet');

  // Carriage Body Hit Meshes (end plates & rear paper table) for horizontal carriage sliding
  if (carriageSys.leftCarriagePlate) registerControlMesh(carriageSys.leftCarriagePlate, 'carriageBody');
  if (carriageSys.rightCarriagePlate) registerControlMesh(carriageSys.rightCarriagePlate, 'carriageBody');
  if (carriageSys.paperTableMesh) registerControlMesh(carriageSys.paperTableMesh, 'carriageBody');

  const carriageBodyHit = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.platenLength + 0.8, 1.45, 1.75),
    hitMat
  );
  carriageBodyHit.position.set(0, 0.25, -0.20);
  carriageSys.carriageGroup.add(carriageBodyHit);
  registerControlMesh(carriageBodyHit, 'carriageBody');

  // Priority table so smaller precision levers/knobs/margin-stops win over large overlapping paper/carriage boxes
  function getControlPriority(cid) {
    if (cid.startsWith('key:')) return 1;
    if (cid === 'marginStopLeft' || cid === 'marginStopRight') return 1;
    if (cid === 'paperReleaseLever' || cid === 'ribbonSwitchLever') return 1;
    if (cid === 'carriageReturnLever') return 2;
    if (cid === 'platenKnobLeft' || cid === 'platenKnobRight') return 2;
    if (cid === 'paperSheet') return 3;
    if (cid === 'platenRoller') return 4;
    if (cid === 'carriageBody') return 5;
    return 6;
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
    const hits = raycaster.intersectObjects(controlMeshes, false);
    if (hits.length === 0) return null;

    let bestHit = null;
    let bestPrio = 999;

    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      const cid = h.object.userData.controlId;
      if (!cid) continue;
      if (cid === 'paperSheet' && !paperSys.isSheetPresent()) continue;

      const prio = getControlPriority(cid);
      if (prio < bestPrio) {
        bestPrio = prio;
        bestHit = h;
        if (prio === 1) break;
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

  // Hover cursor feedback on desktop (`grab` over grabbable parts, `grabbing` while dragging)
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
      gestureMode: null, // 'roll' | 'slide' | 'pullOut'
      pullArmed: carriageSys.state.paperReleased,
      pullRatio: 0,
      holdTimer: null,
      didTriggerAction: false
    };

    // Arm pull-to-remove after a 250ms hold on the paper sheet (even when Paper Release is OFF)
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

    // Immediate response for keys & toggle levers on pointerdown
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

    // 1. Platen Knobs & Platen Roller: 1:1 continuous vertical rotation + fractional paper scroll
    if (cid === 'platenKnobLeft' || cid === 'platenKnobRight' || cid === 'platenRoller') {
      if (!paperSys.isSheetPresent()) {
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
      } else if (activeDrag.totalDist > 2) {
        // Dragging UP (dy < 0) = positive deltaLines (winds paper UP)
        const deltaLines = -dy / 26.0;
        onPlatenLineFeed(deltaLines, false);
        activeDrag.didTriggerAction = true;
      }
      return;
    }

    // 2. Carriage Body: continuous horizontal carriage slide
    if (cid === 'carriageBody') {
      if (activeDrag.totalDist > 3) {
        onCarriageSlideContinuous(dx);
        activeDrag.didTriggerAction = true;
      }
      return;
    }

    // 3 & 4. Paper Sheet Gestures: distinguish by first movement & hold state
    if (cid === 'paperSheet') {
      if (!activeDrag.gestureMode && activeDrag.totalDist > 7) {
        clearHoldTimer(activeDrag);
        const heldMs = performance.now() - activeDrag.downTime;
        if (Math.abs(totalDx) > Math.abs(totalDy) * 1.15) {
          activeDrag.gestureMode = 'slide';
          showPullToast(false);
        } else {
          // Vertical movement on paper: pull-out if paper release is ON or held >= 250ms and dragging UP
          const isPullUp = totalDy < 0 && (carriageSys.state.paperReleased || activeDrag.pullArmed || heldMs >= 250);
          activeDrag.gestureMode = isPullUp ? 'pullOut' : 'roll';
          if (isPullUp) showPullToast(true);
        }
      }

      // Also upgrade a vertical roll to pull-out if user held >=250ms and dragged up more than 40px
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
        // Full sheet height on screen corresponds to ~220px; 25% threshold is ~55px (pullRatio >= 0.25)
        const pullRatio = pullPx / 220.0;
        activeDrag.pullRatio = pullRatio;
        paperSys.setPullOutOffset(pullRatio);
        activeDrag.didTriggerAction = true;

        // If pulled past 45% during the drag, fly out immediately
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

    // Finalize continuous drag gestures on pointer release
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
      // Handle quick taps
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
