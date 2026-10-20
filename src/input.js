import * as THREE from 'three';

/**
 * Handles physical keyboard events (with an immediate zero-drop queue so rapid typing
 * at 12+ chars/sec never drops a single character), 'Escape' clean-screenshot HUD toggle,
 * 3D raycast clicking/tapping on keys, and a hidden mobile text input.
 */
export function createInputSystem({
  rendererDom,
  camera,
  keyMap,
  charToKeyMap,
  clickableMeshes,
  onPrintableKey,
  onSpace,
  onBackspace,
  onCarriageReturn,
  onShiftChange,
  onToggleRibbonColor,
  onToggleHudVisibility
}) {
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2(0, 0);
  const actionQueue = [];

  function enqueue(action) {
    actionQueue.push(action);
  }

  function processQueue() {
    while (actionQueue.length > 0) {
      const act = actionQueue.shift();
      act();
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // Escape key toggles HUD visibility for clean screenshots
    if (e.key === 'Escape') {
      e.preventDefault();
      if (onToggleHudVisibility) onToggleHudVisibility();
      return;
    }

    // Ignore held-key auto-repeat so holding a key doesn't spam, while rapid distinct keydowns queue immediately
    if (e.repeat) return;

    if (e.key === 'Shift') {
      onShiftChange(true);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      enqueue(() => onToggleRibbonColor());
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      enqueue(() => onCarriageReturn());
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      enqueue(() => onBackspace());
      return;
    }

    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      enqueue(() => onSpace());
      return;
    }

    // Lookup key controller by physical code first, or fallback to character map
    let ctrl = keyMap.get(e.code);
    if (!ctrl || ctrl.isSpecial) {
      ctrl = charToKeyMap.get(e.key) || charToKeyMap.get(e.key.toLowerCase());
    }

    if (ctrl && !ctrl.isSpecial) {
      e.preventDefault();
      const explicitChar = e.key && e.key.length === 1 ? e.key : null;
      enqueue(() => onPrintableKey(ctrl, explicitChar));
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      onShiftChange(false);
    }
  });

  // Pointer move for subtle camera parallax
  window.addEventListener('pointermove', (e) => {
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // 3D Keycap & Return Lever Raycasting
  rendererDom.addEventListener('pointerdown', (e) => {
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(clickableMeshes, false);
    if (hits.length > 0) {
      const ctrl = hits[0].object.userData.keyController;
      if (!ctrl) return;
      if (ctrl.code === 'Space') {
        enqueue(() => onSpace());
      } else if (ctrl.code === 'Enter') {
        enqueue(() => onCarriageReturn());
      } else if (ctrl.code === 'Backspace') {
        enqueue(() => onBackspace());
      } else if (ctrl.code === 'Tab') {
        enqueue(() => onToggleRibbonColor());
      } else if (ctrl.code === 'ShiftLeft' || ctrl.code === 'ShiftRight') {
        onShiftChange('toggle');
      } else {
        enqueue(() => onPrintableKey(ctrl, null));
      }
    }
  });

  // Hidden mobile input for on-screen virtual keyboards
  const mobileInput = document.getElementById('mobile-input');
  const btnKb = document.getElementById('btn-kb');
  if (btnKb && mobileInput) {
    btnKb.addEventListener('click', () => {
      mobileInput.focus();
    });

    mobileInput.addEventListener('input', () => {
      const val = mobileInput.value;
      if (!val) return;
      for (let i = 0; i < val.length; i++) {
        const ch = val[i];
        if (ch === ' ') {
          enqueue(() => onSpace());
        } else if (ch === '\n') {
          enqueue(() => onCarriageReturn());
        } else {
          const ctrl = charToKeyMap.get(ch) || charToKeyMap.get(ch.toLowerCase());
          if (ctrl) enqueue(() => onPrintableKey(ctrl, ch));
        }
      }
      mobileInput.value = '';
    });
  }

  return {
    pointerNDC,
    processQueue
  };
}
