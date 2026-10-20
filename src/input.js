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

  const mobileInputEl = document.getElementById('mobile-input');
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // While the hidden input is focused, printable keys and backspace arrive via its input event
    if (mobileInputEl && e.target === mobileInputEl && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Unidentified' || e.key === 'Process')) return;

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

  // Hidden mobile input for on-screen virtual keyboards.
  // Focus must happen inside a user gesture handler. A zero-width sentinel char keeps the
  // field non-empty so Backspace always produces an input event on Android and iOS.
  const mobileInput = mobileInputEl;
  const SENT = '\u200b';
  let prev = '';
  function resetInput() {
    if (!mobileInput) return;
    mobileInput.value = SENT;
    prev = '';
    try { mobileInput.setSelectionRange(1, 1); } catch (_) {}
  }
  function typeChar(ch) {
    if (ch === ' ') return enqueue(() => onSpace());
    if (ch === '\n' || ch === '\r') return enqueue(() => onCarriageReturn());
    const ctrl = charToKeyMap.get(ch) || charToKeyMap.get(ch.toLowerCase());
    if (ctrl && !ctrl.isSpecial) enqueue(() => onPrintableKey(ctrl, ch));
  }
  function openKeyboard() {
    if (!mobileInput) return;
    if (!mobileInput.value) resetInput();
    mobileInput.focus({ preventScroll: true });
    try { mobileInput.setSelectionRange(1, 1); } catch (_) {}
  }
  if (mobileInput) {
    resetInput();
    mobileInput.addEventListener('input', (e) => {
      const v = mobileInput.value;
      if (!v.startsWith(SENT)) {
        // sentinel deleted: one backspace (or more if field was cleared of typed text)
        const n = Math.max(1, prev.length);
        for (let i = 0; i < n; i++) enqueue(() => onBackspace());
        resetInput();
        return;
      }
      const cur = v.slice(1);
      if (cur.startsWith(prev)) {
        for (const ch of cur.slice(prev.length)) typeChar(ch);
      } else if (prev.startsWith(cur)) {
        for (let i = 0; i < prev.length - cur.length; i++) enqueue(() => onBackspace());
      } else {
        for (const ch of cur) typeChar(ch);
      }
      prev = cur;
      if (!e.isComposing) resetInput();
    });
    mobileInput.addEventListener('compositionend', resetInput);
    mobileInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); }
    });
    ['btn-kb', 'btn-kb-m'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', (e) => { e.preventDefault(); openKeyboard(); });
    });
    // Tapping the typewriter or paper opens the keyboard on touch devices
    rendererDom.addEventListener('click', () => {
      if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) openKeyboard();
    });
    window.addEventListener('focus', () => {});
  }

  return {
    pointerNDC,
    processQueue
  };
}
