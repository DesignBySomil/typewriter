import * as THREE from 'three';
import { CONFIG } from './config.js';

/**
 * Attaches enlarged >=44px-equivalent invisible raycast hit meshes with `userData.controlId`
 * to every physical typewriter control on the 3D machine:
 * - All 44 letter/number/punctuation keys + Space, Shift L/R, Backspace, Return, Tab
 * - Carriage return lever (tap or drag right)
 * - Left & Right platen knobs (drag up/down or tap top/bottom half)
 * - Ribbon colour switch lever (tap cycles black / red / stencil)
 * - Left & Right margin stop sliders on the scale rail (drag left/right)
 * - Paper release lever (tap toggles release so paper/knobs turn freely without line snapping)
 * - Paper sheet & Platen roller (tap paper to pull out; tap empty platen to insert a fresh blank sheet)
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
  onUpdateMargins,
  onTogglePaperRelease,
  onRemoveOrInsertPaper,
  onTouchCanvasFocus
}) {
  const controlMeshes = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  function registerControlMesh(mesh, controlId, extraData = {}) {
    mesh.userData.controlId = controlId;
    Object.assign(mesh.userData, extraData);
    controlMeshes.push(mesh);
  }

  // 1 & 2. Register all keys (already have enlarged 1.5x hit meshes in keysSys.clickableMeshes)
  keysSys.clickableMeshes.forEach((m) => {
    const ctrl = m.userData.keyController;
    if (!ctrl) return;
    if (ctrl.code === 'Enter' && ctrl.label === 'RETURN LEVER') return;
    registerControlMesh(m, `key:${ctrl.code}`, { keyController: ctrl });
  });

  // 3. Carriage Return Lever (enlarged hit box for >=44px mobile touch)
  const crHit = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.85, 2.25), hitMat);
  crHit.position.set(0.10, 0.12, 0.95);
  carriageSys.returnLeverGroup.add(crHit);
  registerControlMesh(crHit, 'carriageReturnLever');

  // 4. Left & Right Platen Knobs (enlarged hit cylinders for tap top/bottom or drag up/down)
  const knobHitGeo = new THREE.CylinderGeometry(0.76, 0.76, 0.95, 16);
  knobHitGeo.rotateZ(Math.PI / 2);

  const leftKnobHit = new THREE.Mesh(knobHitGeo, hitMat);
  carriageSys.leftKnob.add(leftKnobHit);
  registerControlMesh(leftKnobHit, 'platenKnobLeft');

  const rightKnobHit = new THREE.Mesh(knobHitGeo, hitMat);
  carriageSys.rightKnob.add(rightKnobHit);
  registerControlMesh(rightKnobHit, 'platenKnobRight');

  // 5. Ribbon Colour Switch Lever on the right top cover
  const ribSelHit = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.65, 0.95), hitMat);
  ribSelHit.position.set(0, 0.12, 0.08);
  chassis.ribbonSelectorBase.add(ribSelHit);
  registerControlMesh(ribSelHit, 'ribbonSwitchLever');

  // 6. Left & Right Margin Stop Sliders on the scale rail
  const marginStopHitGeo = new THREE.BoxGeometry(0.95, 0.85, 0.85);
  const leftStopHit = new THREE.Mesh(marginStopHitGeo, hitMat);
  leftStopHit.position.set(0, 0.15, 0);
  carriageSys.leftMarginStopGroup.add(leftStopHit);
  registerControlMesh(leftStopHit, 'marginStopLeft');

  const rightStopHit = new THREE.Mesh(marginStopHitGeo, hitMat);
  rightStopHit.position.set(0, 0.15, 0);
  carriageSys.rightMarginStopGroup.add(rightStopHit);
  registerControlMesh(rightStopHit, 'marginStopRight');

  // 7. Paper Release Lever on the right side of the carriage
  const prLeverHit = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.90, 0.90), hitMat);
  prLeverHit.position.set(0.05, 0.22, 0.08);
  carriageSys.paperReleaseLeverGroup.add(prLeverHit);
  registerControlMesh(prLeverHit, 'paperReleaseLever');

  // 8. Paper Sheet & Empty Platen Roller
  registerControlMesh(paperSys.paperMesh, 'paperSheet');
  registerControlMesh(carriageSys.platenMesh, 'platenRoller');

  // Raycasting & Pointer Drag State
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
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      if (h.object.userData.controlId === 'paperSheet' && !paperSys.isSheetPresent()) {
        continue;
      }
      return h;
    }
    return null;
  }

  // Hover cursor feedback on desktop
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
      if (
        cid === 'marginStopLeft' ||
        cid === 'marginStopRight' ||
        cid === 'carriageReturnLever'
      ) {
        rendererDom.style.cursor = 'ew-resize';
      } else if (cid === 'platenKnobLeft' || cid === 'platenKnobRight') {
        rendererDom.style.cursor = 'ns-resize';
      } else {
        rendererDom.style.cursor = 'pointer';
      }
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

    activeDrag = {
      pointerId: e.pointerId,
      controlId: cid,
      hitObject: hit.object,
      hitPointWorld: hit.point.clone(),
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      totalDist: 0,
      accumulatedSteps: 0,
      didTriggerAction: false
    };

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
    } else if (cid === 'platenRoller') {
      if (!paperSys.isSheetPresent()) {
        onRemoveOrInsertPaper('insert');
        activeDrag.didTriggerAction = true;
      }
    }
  });

  function handleDragMove(e) {
    if (!activeDrag) return;
    const dx = e.clientX - activeDrag.lastX;
    const dy = e.clientY - activeDrag.lastY;
    activeDrag.lastX = e.clientX;
    activeDrag.lastY = e.clientY;
    activeDrag.totalDist += Math.hypot(dx, dy);

    const cid = activeDrag.controlId;

    // 3. Dragging Carriage Return Lever to the right
    if (cid === 'carriageReturnLever') {
      const totalDx = Math.max(0, e.clientX - activeDrag.startX);
      carriageSys.state.returnLeverDragSwing = Math.min(0.68, totalDx * 0.012);
      if (totalDx > 36 && !activeDrag.didTriggerAction) {
        activeDrag.didTriggerAction = true;
        onCarriageReturn();
      }
    }

    // 4. Dragging Platen Knobs up/down
    if (cid === 'platenKnobLeft' || cid === 'platenKnobRight') {
      const totalDy = activeDrag.startY - e.clientY; // Dragging UP = positive = roll paper UP
      if (carriageSys.state.paperReleased) {
        // Free smooth rotation when paper release lever is engaged
        const freeLines = -dy * 0.035;
        onPlatenLineFeed(freeLines, false);
        activeDrag.didTriggerAction = true;
      } else {
        // Ratchet notched line feed (1 line per 22px dragged)
        const targetSteps = Math.trunc(totalDy / 22);
        const stepDiff = targetSteps - activeDrag.accumulatedSteps;
        if (stepDiff !== 0) {
          activeDrag.accumulatedSteps = targetSteps;
          onPlatenLineFeed(stepDiff, true);
          activeDrag.didTriggerAction = true;
        }
      }
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

    // 7 & 8. Dragging the Paper Sheet freely when Paper Release Lever is unlocked
    if (cid === 'paperSheet' && carriageSys.state.paperReleased && activeDrag.totalDist > 8) {
      const freeLines = -dy * 0.04;
      onPlatenLineFeed(freeLines, false);
      activeDrag.didTriggerAction = true;
    }
  }

  function finishPointerInteraction(e) {
    if (!activeDrag || activeDrag.pointerId !== e.pointerId) return;
    const cid = activeDrag.controlId;
    carriageSys.state.returnLeverDragSwing = 0;

    // Handle simple taps (when user didn't drag past threshold)
    if (!activeDrag.didTriggerAction && activeDrag.totalDist < 12) {
      if (cid === 'carriageReturnLever') {
        onCarriageReturn();
      } else if (cid === 'platenKnobLeft' || cid === 'platenKnobRight') {
        // Tap top half of knob = line feed up (+1), bottom half = line feed down (-1)
        const knobCenterWorld = new THREE.Vector3();
        const knobObj = cid === 'platenKnobLeft' ? carriageSys.leftKnob : carriageSys.rightKnob;
        knobObj.getWorldPosition(knobCenterWorld);
        const dir = activeDrag.hitPointWorld.y >= knobCenterWorld.y ? 1 : -1;
        onPlatenLineFeed(dir, true);
      } else if (cid === 'paperSheet') {
        onRemoveOrInsertPaper('toggle');
      }
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
