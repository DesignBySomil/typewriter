import * as THREE from 'three';

const SENTINEL = '\u200B';

/**
 * Handles physical keyboard events, mobile virtual keyboard via `#mobile-input`
 * with a zero-width-space sentinel character (so Backspace always fires an `input` event),
 * focus triggers on `#btn-kb`, `#btn-kb-m`, `#btn-kb-big`, and `Ctrl/Cmd+P` print shortcut.
 */
export function createInputSystem({
  rendererDom,
  keyMap,
  charToKeyMap,
  onPrintableKey,
  onSpace,
  onBackspace,
  onCarriageReturn,
  onShiftChange,
  onToggleRibbonColor,
  onToggleHudVisibility,
  onPrintShortcut,
  isExportPanelOpen,
  onCloseExportPanel
}) {
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

  const mobileInput = document.getElementById('mobile-input');

  function resetMobileSentinel() {
    if (!mobileInput) return;
    mobileInput.value = SENTINEL;
    try {
      mobileInput.setSelectionRange(1, 1);
    } catch (_) {}
  }

  function focusMobileKeyboard() {
    if (!mobileInput) return;
    resetMobileSentinel();
    mobileInput.focus({ preventScroll: true });
  }

  if (mobileInput) {
    resetMobileSentinel();

    ['btn-kb', 'btn-kb-m', 'btn-kb-big'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          focusMobileKeyboard();
        });
      }
    });

    mobileInput.addEventListener('focus', () => {
      resetMobileSentinel();
    });

    mobileInput.addEventListener('input', () => {
      const val = mobileInput.value;

      // If sentinel was deleted, user pressed Backspace on mobile virtual keyboard
      if (val.length === 0 || !val.startsWith(SENTINEL)) {
        enqueue(() => onBackspace());
        resetMobileSentinel();
        return;
      }

      const typed = val.slice(SENTINEL.length);
      for (let i = 0; i < typed.length; i++) {
        const ch = typed[i];
        if (ch === ' ') {
          enqueue(() => onSpace());
        } else if (ch === '\n' || ch === '\r') {
          enqueue(() => onCarriageReturn());
        } else {
          const ctrl = charToKeyMap.get(ch) || charToKeyMap.get(ch.toLowerCase());
          if (ctrl) enqueue(() => onPrintableKey(ctrl, ch));
        }
      }
      resetMobileSentinel();
    });
  }

  window.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + P triggers the typewriter page Print
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      if (onPrintShortcut) onPrintShortcut();
      return;
    }

    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (isExportPanelOpen && isExportPanelOpen()) {
        if (onCloseExportPanel) onCloseExportPanel();
      } else if (onToggleHudVisibility) {
        onToggleHudVisibility();
      }
      return;
    }

    if (e.repeat) return;

    // Ignore printable keys and Backspace when target is #mobile-input so its `input` handler processes them once
    const isFromMobileInput = e.target === mobileInput;

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
      if (isFromMobileInput) resetMobileSentinel();
      return;
    }

    if (isFromMobileInput) return;

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

  window.addEventListener('pointermove', (e) => {
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  return {
    pointerNDC,
    processQueue,
    focusMobileKeyboard
  };
}
