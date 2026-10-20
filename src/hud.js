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

  const compactCol  = document.getElementById('compact-col');
  const compactLine = document.getElementById('compact-line');
  const compactKey  = document.getElementById('compact-key');
  const compactBell = document.getElementById('compact-bell');

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

  const anchorCarriageW = new THREE.Vector3();
  const anchorPlatenW   = new THREE.Vector3();
  const anchorBasketW   = new THREE.Vector3(-1.25, 1.68, -0.25);
  const anchorRibbonW   = new THREE.Vector3(3.35, 2.34, 0.42);

  function triggerBellFlash() {
    if (!boxCarriage) return;
    boxCarriage.classList.add('bell-flash');
    setTimeout(() => boxCarriage.classList.remove('bell-flash'), 650);
  }

  function updateHud(telemetry, bounds) {
    const relCol = Math.max(0, telemetry.col - bounds.minCol);
    const totalCols = bounds.totalCols;
    const mmPos = (relCol * 3.4).toFixed(1);
    const colStr = String(relCol + 1).padStart(2, '0');
    hudValCarriage.textContent = `${mmPos} mm [${colStr}/${totalCols}]`;

    const bellRemaining = (bounds.maxCol - CONFIG.bellOffset) - telemetry.col;
    if (telemetry.marginLocked) {
      hudValBell.textContent = 'MARGIN LOCKED [CR]';
      hudValBell.style.fill = '#e05846';
    } else if (bellRemaining > 0) {
      hudValBell.textContent = `BELL IN: ${bellRemaining} CHARS`;
      hudValBell.style.fill = '#6ec4b8';
    } else {
      hudValBell.textContent = `BELL RUNG // ${Math.max(0, bounds.maxCol - telemetry.col)} LEFT`;
      hudValBell.style.fill = '#d8af72';
    }

    const lineStr = String(telemetry.pageLine + 1).padStart(2, '0');
    hudValLine.textContent = telemetry.paperReleased
      ? `LINE ${lineStr} [FREE]`
      : `LINE ${lineStr} / ${CONFIG.maxLinesPerPage}`;

    hudValCase.textContent = (telemetry.shiftDown || telemetry.shiftLockedNext)
      ? 'BASKET: UPPER [SHIFT]'
      : 'BASKET: LOWERCASE';

    hudValLastKey.textContent = `LAST: ${telemetry.lastKeyLabel}`;
    hudValStrikes.textContent = `STRIKES: ${String(telemetry.strikes).padStart(4, '0')}`;

    const ribMode = telemetry.ribbonColor === 'red'
      ? 'RED'
      : (telemetry.ribbonColor === 'stencil' ? 'STN' : 'BLK');
    hudValRibbon.textContent = `${ribMode} // ${telemetry.ribbonInk.toFixed(1)}%`;
    hudValRibbon.style.fill = telemetry.ribbonColor === 'red'
      ? '#e05846'
      : (telemetry.ribbonColor === 'stencil' ? '#6ec4b8' : '#f4ece0');
    hudValSpool.textContent = `SPOOL: ${telemetry.spoolAngle.toFixed(2)} RAD`;

    if (compactCol) {
      compactCol.textContent = `POS:${mmPos}mm`;
      compactLine.textContent = `LN:${lineStr}/${CONFIG.maxLinesPerPage}`;
      compactKey.textContent = `KEY:${telemetry.lastKeyLabel}`;
      compactBell.textContent = telemetry.marginLocked ? 'LOCKED' : `BELL:${Math.max(0, bellRemaining)}`;
    }

    const pts = telemetry.strikeIntervals.map((val, idx) => {
      const x = 8 + (idx / Math.max(1, telemetry.strikeIntervals.length - 1)) * 132;
      const norm = 1.0 - Math.min(1.0, (val - 30) / 420);
      const y = 62 - norm * 15;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    hudSparkline.setAttribute('points', pts);

    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w >= 820 && h >= 560) {
      anchorCarriageW.set(carriageGroup.position.x - 5.05, 3.32, -0.95);
      anchorPlatenW.set(carriageGroup.position.x + 4.85, 3.12, -1.12);

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
