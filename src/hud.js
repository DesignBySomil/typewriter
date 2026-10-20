import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createHudSystem(camera, carriageGroup) {
  const hudCornersGroup = document.getElementById('hud-corners');
  const boxCarriage     = document.getElementById('box-carriage');
  const hudValCarriage  = document.getElementById('hud-val-carriage');
  const hudValBell      = document.getElementById('hud-val-bell');
  const hudValLine      = document.getElementById('hud-val-line');
  const hudValCase      = document.getElementById('hud-val-case');
  const hudValLastKey   = document.getElementById('hud-val-lastkey');
  const hudValStrikes   = document.getElementById('hud-val-strikes');
  const hudValRibbon    = document.getElementById('hud-val-ribbon');
  const hudValSpool     = document.getElementById('hud-val-spool');
  const hudSparkline    = document.getElementById('hud-sparkline');

  const cardCarriage = document.getElementById('card-carriage');
  const cardPlaten   = document.getElementById('card-platen');
  const cardBasket   = document.getElementById('card-basket');
  const cardRibbon   = document.getElementById('card-ribbon');

  const leaderCarriage = document.getElementById('leader-carriage');
  const dotCarriage    = document.getElementById('dot-carriage');
  const leaderPlaten   = document.getElementById('leader-platen');
  const dotPlaten      = document.getElementById('dot-platen');
  const leaderBasket   = document.getElementById('leader-basket');
  const dotBasket      = document.getElementById('dot-basket');
  const leaderRibbon   = document.getElementById('leader-ribbon');
  const dotRibbon      = document.getElementById('dot-ribbon');

  // Compact single-line mobile telemetry elements
  const compactCol     = document.getElementById('compact-col');
  const compactLine    = document.getElementById('compact-line');
  const compactKey     = document.getElementById('compact-key');
  const compactStrikes = document.getElementById('compact-strikes');
  const compactBell    = document.getElementById('compact-bell');

  function layoutHud() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pad = w < 820 ? 8 : 12;
    const len = 12;

    hudCornersGroup.innerHTML = `
      <path class="corner-tick" d="M ${pad} ${pad + len} L ${pad} ${pad} L ${pad + len} ${pad}" />
      <path class="corner-tick" d="M ${w - pad - len} ${pad} L ${w - pad} ${pad} L ${w - pad} ${pad + len}" />
      <path class="corner-tick" d="M ${pad} ${h - pad - len} L ${pad} ${h - pad} L ${pad + len} ${h - pad}" />
      <path class="corner-tick" d="M ${w - pad - len} ${h - pad} L ${w - pad} ${h - pad} L ${w - pad} ${h - pad - len}" />
    `;

    // Anchor HUD cards strictly into the 4 outer viewport corners
    cardCarriage.setAttribute('transform', `translate(14, 42)`);
    cardPlaten.setAttribute('transform', `translate(${w - 162}, 42)`);
    cardBasket.setAttribute('transform', `translate(14, ${h - 84})`);
    cardRibbon.setAttribute('transform', `translate(${w - 162}, ${h - 66})`);
  }

  const tempProjVec = new THREE.Vector3();
  function projectWorldToScreen(worldVec) {
    tempProjVec.copy(worldVec).project(camera);
    return {
      x: (tempProjVec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-tempProjVec.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  function setLeaderLine(polyEl, dotEl, cardX, cardY, targetScreen, elbowXOffset) {
    const tx = targetScreen.x;
    const ty = targetScreen.y;
    const ex = cardX + elbowXOffset;
    const ey = cardY;
    polyEl.setAttribute('points', `${cardX},${cardY} ${ex},${ey} ${tx.toFixed(1)},${ty.toFixed(1)}`);
    dotEl.setAttribute('cx', tx.toFixed(1));
    dotEl.setAttribute('cy', ty.toFixed(1));
  }

  // Exact 3D anchor points on actual machine components
  const anchorCarriageW = new THREE.Vector3();
  const anchorPlatenW   = new THREE.Vector3();
  const anchorBasketW   = new THREE.Vector3(-1.35, 1.85, -0.25); // Slotted typebasket arc
  const anchorRibbonW   = new THREE.Vector3(3.35, 2.62, 0.45);   // Right bichrome ribbon spool

  function triggerBellFlash() {
    if (!boxCarriage) return;
    boxCarriage.classList.add('bell-flash');
    setTimeout(() => boxCarriage.classList.remove('bell-flash'), 650);
  }

  function updateHud(telemetry) {
    const mmPos = (telemetry.col * 3.4).toFixed(1);
    const colStr = String(telemetry.col + 1).padStart(2, '0');
    hudValCarriage.textContent = `${mmPos} mm [${colStr}/${CONFIG.maxCols}]`;

    const bellRemaining = (CONFIG.maxCols - CONFIG.bellOffset) - telemetry.col;
    if (telemetry.marginLocked) {
      hudValBell.textContent = 'MARGIN LOCKED [CR]';
      hudValBell.style.fill = '#f25f4c';
    } else if (bellRemaining > 0) {
      hudValBell.textContent = `BELL IN: ${bellRemaining} CHARS`;
      hudValBell.style.fill = '#72d6c9';
    } else {
      hudValBell.textContent = `BELL RUNG // ${CONFIG.maxCols - telemetry.col} LEFT`;
      hudValBell.style.fill = '#e8b878';
    }

    const lineStr = String(telemetry.pageLine + 1).padStart(2, '0');
    hudValLine.textContent = `LINE ${lineStr} / ${CONFIG.maxLinesPerPage}`;
    hudValCase.textContent = telemetry.shiftDown ? 'BASKET: UPPER [SHIFT]' : 'BASKET: LOWERCASE';

    hudValLastKey.textContent = `LAST: ${telemetry.lastKeyLabel}`;
    hudValStrikes.textContent = `STRIKES: ${String(telemetry.strikes).padStart(4, '0')}`;

    const ribMode = telemetry.ribbonColor === 'red' ? 'RED' : 'BLK';
    hudValRibbon.textContent = `${ribMode} // ${telemetry.ribbonInk.toFixed(1)}%`;
    hudValRibbon.style.fill = telemetry.ribbonColor === 'red' ? '#f25f4c' : '#fff8ed';
    hudValSpool.textContent = `SPOOL: ${telemetry.spoolAngle.toFixed(2)} RAD`;

    // Compact mobile readout update
    if (compactCol) {
      compactCol.textContent = `POS: ${mmPos}mm`;
      compactLine.textContent = `LN: ${lineStr}/${CONFIG.maxLinesPerPage}`;
      compactKey.textContent = `KEY: ${telemetry.lastKeyLabel}`;
      compactStrikes.textContent = `STR: ${telemetry.strikes}`;
      compactBell.textContent = telemetry.marginLocked ? 'LOCKED' : `BELL: ${Math.max(0, bellRemaining)}`;
    }

    // Update live strike interval sparkline
    const pts = telemetry.strikeIntervals.map((val, idx) => {
      const x = 8 + (idx / Math.max(1, telemetry.strikeIntervals.length - 1)) * 132;
      const norm = 1.0 - Math.min(1.0, (val - 30) / 420);
      const y = 64 - norm * 15;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    hudSparkline.setAttribute('points', pts);

    // Project 3D anchors to 2D SVG leader lines ending directly on the physical machine parts
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w >= 820 && h >= 560) {
      // Left carriage return lever / end-plate
      anchorCarriageW.set(carriageGroup.position.x - 5.45, 3.65, -0.95);
      // Right rubber platen roller end-cap
      anchorPlatenW.set(carriageGroup.position.x + 5.15, 3.45, -1.15);

      const sCarriage = projectWorldToScreen(anchorCarriageW);
      const sPlaten   = projectWorldToScreen(anchorPlatenW);
      const sBasket   = projectWorldToScreen(anchorBasketW);
      const sRibbon   = projectWorldToScreen(anchorRibbonW);

      setLeaderLine(leaderCarriage, dotCarriage, 162, 68, sCarriage, 22);
      setLeaderLine(leaderBasket, dotBasket, 162, h - 50, sBasket, 22);
      setLeaderLine(leaderPlaten, dotPlaten, w - 162, 68, sPlaten, -22);
      setLeaderLine(leaderRibbon, dotRibbon, w - 162, h - 40, sRibbon, -22);
    }
  }

  layoutHud();

  return {
    layoutHud,
    updateHud,
    triggerBellFlash
  };
}
