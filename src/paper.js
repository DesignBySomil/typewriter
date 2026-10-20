import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PAPER_VERTEX_SHADER, PAPER_FRAGMENT_SHADER } from './shaders/paper.js';

const LINE0_Y = CONFIG.LINE0_Y || 250;
const MAX_LINE = CONFIG.MAX_LINE || 24;

export function createPaperSystem(carriageGroup) {
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = CONFIG.paperCanvasW;
  paperCanvas.height = CONFIG.paperCanvasH;
  const paperCtx = paperCanvas.getContext('2d');

  // Snapshot canvas preserves the last completed/removed sheet so PRINT / SAVE still works after ejecting a sheet!
  const lastArchivedCanvas = document.createElement('canvas');
  lastArchivedCanvas.width = CONFIG.paperCanvasW;
  lastArchivedCanvas.height = CONFIG.paperCanvasH;
  const lastArchivedCtx = lastArchivedCanvas.getContext('2d');
  let hasArchivedSheet = false;
  let currentSheetHasInk = false;

  const strikeGrid = new Map();

  let currentCanvasLine = 0;
  let scrollVCurrent = 0.0;
  let scrollVTarget = 0.0;
  let scrollVVel = 0.0;

  // Sheet presence state: 'seated' | 'inserting' | 'ejecting' | 'removed'
  let sheetStatus = 'inserting';
  let insertAnimProgress = 0.0;

  function archiveCurrentCanvasIfInked() {
    if (currentSheetHasInk) {
      lastArchivedCtx.clearRect(0, 0, lastArchivedCanvas.width, lastArchivedCanvas.height);
      lastArchivedCtx.drawImage(paperCanvas, 0, 0);
      hasArchivedSheet = true;
    }
  }

  function clearPaperCanvas() {
    archiveCurrentCanvasIfInked();
    paperCtx.fillStyle = '#000000';
    paperCtx.fillRect(0, 0, paperCanvas.width, paperCanvas.height);
    strikeGrid.clear();
    currentCanvasLine = 0;
    scrollVCurrent = 0.0;
    scrollVTarget = 0.0;
    scrollVVel = 0.0;
    currentSheetHasInk = false;
  }
  clearPaperCanvas();

  const paperTexture = new THREE.CanvasTexture(paperCanvas);
  paperTexture.flipY = true;
  paperTexture.minFilter = THREE.LinearFilter;
  paperTexture.magFilter = THREE.LinearFilter;
  paperTexture.anisotropy = 4;

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      paperTexture.needsUpdate = true;
    });
  }

  /**
   * Stamps a typewriter glyph onto the 2048x2048 CanvasTexture:
   * Line 0 is drawn near the top of the texture (LINE0_Y = 250px) and subsequent lines
   * advance DOWNWARD (+paperLinePxY per line) so the page reads top-to-bottom in typing order!
   */
  function stampCharacter(char, col, _unusedOffset = 0, ribbonColor = 'black', absoluteLineId = 0) {
    if (sheetStatus === 'removed' || sheetStatus === 'ejecting') return;

    const key = `${absoluteLineId}:${col}`;
    const prevStrikes = strikeGrid.get(key) || 0;
    strikeGrid.set(key, prevStrikes + 1);

    const isPortrait = (window.innerWidth / Math.max(1, window.innerHeight)) < 0.92;
    let centerX = CONFIG.paperCol0PxX + col * CONFIG.paperCharPxX;
    let fontSizePx = 66;

    if (isPortrait) {
      const relCol = Math.max(0, col - 5);
      const portraitStepPx = (CONFIG.paperCanvasW - 220) / CONFIG.portraitCols;
      centerX = 110 + relCol * portraitStepPx;
      fontSizePx = 76;
    }

    // Top-to-bottom line order: line 0 at LINE0_Y (250), line n at LINE0_Y + n * paperLinePxY
    const baselineY = LINE0_Y + currentCanvasLine * CONFIG.paperLinePxY;

    const jitterX = (Math.random() - 0.5) * 2.0;
    const jitterY = (Math.random() - 0.5) * 2.8;
    const rotJitter = (Math.random() - 0.5) * 0.032;
    const baseDensity = Math.min(255, Math.floor(228 + Math.random() * 27 + prevStrikes * 35));

    // Support 'black', 'red', and 'stencil' (blind letterpress deboss with zero ink)
    const rVal = ribbonColor === 'black' ? baseDensity : 0;
    const gVal = ribbonColor === 'red'   ? baseDensity : 0;
    const bVal = baseDensity;

    paperCtx.save();
    paperCtx.globalCompositeOperation = 'lighter';
    paperCtx.translate(centerX + jitterX, baselineY + jitterY);
    paperCtx.rotate(rotJitter);

    paperCtx.font = `bold ${fontSizePx}px "Courier Prime", "Special Elite", "Courier New", Courier, monospace`;
    paperCtx.textAlign = 'center';
    paperCtx.textBaseline = 'alphabetic';

    paperCtx.shadowColor = `rgb(${Math.floor(rVal * 0.65)}, ${Math.floor(gVal * 0.65)}, ${Math.floor(bVal * 0.72)})`;
    paperCtx.shadowBlur = 4.5;
    paperCtx.fillStyle = `rgb(${Math.floor(rVal * 0.85)}, ${Math.floor(gVal * 0.85)}, ${Math.floor(bVal * 0.85)})`;
    paperCtx.fillText(char, 0, 0);

    paperCtx.shadowBlur = 0;
    paperCtx.fillStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
    paperCtx.fillText(char, 0, 0);
    paperCtx.lineWidth = 1.8;
    paperCtx.strokeStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
    paperCtx.strokeText(char, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7);

    if (ribbonColor !== 'stencil') {
      const speckCount = 3 + Math.floor(Math.random() * 4);
      for (let s = 0; s < speckCount; s++) {
        const sx = (Math.random() - 0.5) * (fontSizePx * 0.78);
        const sy = -fontSizePx * 0.35 + (Math.random() - 0.5) * (fontSizePx * 0.82);
        const sRad = 0.8 + Math.random() * 1.4;
        const sIntensity = Math.floor(baseDensity * (0.45 + Math.random() * 0.45));
        const sr = ribbonColor === 'black' ? sIntensity : 0;
        const sg = ribbonColor === 'red'   ? sIntensity : 0;
        paperCtx.fillStyle = `rgb(${sr}, ${sg}, ${sIntensity})`;
        paperCtx.beginPath();
        paperCtx.arc(sx, sy, sRad, 0, Math.PI * 2);
        paperCtx.fill();
      }
    }

    paperCtx.restore();
    currentSheetHasInk = true;
    paperTexture.needsUpdate = true;
  }

  /**
   * Advances line index downward on the page and scrolls paper UP around the platen
   * (negative scrollV per line) so earlier lines move UP above the strike line.
   */
  function rollCanvasTextUpOneLine() {
    const lineStepV = CONFIG.paperLinePxY / CONFIG.paperCanvasH;

    if (currentCanvasLine >= MAX_LINE) {
      const dy = CONFIG.paperLinePxY;
      const w = paperCanvas.width;
      const h = paperCanvas.height;
      const imageData = paperCtx.getImageData(0, dy, w, h - dy);
      paperCtx.fillStyle = '#000000';
      paperCtx.fillRect(0, 0, w, h);
      paperCtx.putImageData(imageData, 0, 0);
      paperTexture.needsUpdate = true;
      scrollVCurrent += lineStepV;
    } else {
      currentCanvasLine++;
    }

    // Negative scroll moves Texture V down to the new line and shifts earlier lines UP the physical sheet!
    scrollVTarget = -currentCanvasLine * lineStepV;
    scrollVVel -= lineStepV * 4.8;
  }

  /**
   * Supports turning the platen knobs or dragging released paper up/down by fractional or integer lines
   */
  function scrollByLines(deltaLines, snapToLine = true) {
    const lineStepV = CONFIG.paperLinePxY / CONFIG.paperCanvasH;
    currentCanvasLine = THREE.MathUtils.clamp(currentCanvasLine + deltaLines, 0, MAX_LINE);
    if (snapToLine) {
      currentCanvasLine = Math.round(currentCanvasLine);
    }
    scrollVTarget = -currentCanvasLine * lineStepV;
    paperUniforms.uFeedWave.value = Math.min(1.0, Math.abs(deltaLines) * 0.65);
    return currentCanvasLine;
  }

  const paperUniforms = {
    uTextMap: { value: paperTexture },
    uTime: { value: 0 },
    uScrollV: { value: 0.0 },
    uFeedWave: { value: 0.0 },
    uInsertProgress: { value: 0.0 },
    uLightDir: { value: new THREE.Vector3(-8.5, 11.5, 6.2).normalize() }
  };

  const paperShaderMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: paperUniforms,
    vertexShader: PAPER_VERTEX_SHADER,
    fragmentShader: PAPER_FRAGMENT_SHADER
  });

  function createCurvedPaperGeometry(width, heightSegments = 64) {
    const geo = new THREE.PlaneGeometry(width, 1.0, 48, heightSegments);
    const posAttr = geo.attributes.position;
    const r = CONFIG.platenRadius + 0.022;

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const u = posAttr.getY(i) + 0.5;
      let py = 0;
      let pz = 0;

      if (u < 0.22) {
        const t = u / 0.22;
        const angle = -Math.PI * 0.52 * (1.0 - t);
        py = Math.sin(angle) * r;
        pz = Math.cos(angle) * r;
      } else if (u < 0.30) {
        const t = (u - 0.22) / 0.08;
        const angle = t * (Math.PI * 0.21);
        py = Math.sin(angle) * r;
        pz = Math.cos(angle) * r;
      } else {
        const t = (u - 0.30) / 0.70;
        const baseAngle = Math.PI * 0.21;
        const startY = Math.sin(baseAngle) * r;
        const startZ = Math.cos(baseAngle) * r;
        const sheetLen = CONFIG.paperSheetHeight;

        const topCurlZ = Math.pow(t, 2.6) * 0.38 - Math.sin(t * Math.PI) * 0.08;
        const topCurlY = -Math.pow(t, 3.2) * 0.14;
        const edgeLiftZ = Math.pow(vx / (width * 0.5), 2.0) * Math.pow(t, 1.8) * 0.09;

        py = startY + t * sheetLen * Math.cos(0.21) + topCurlY;
        pz = startZ - t * sheetLen * Math.sin(0.21) - topCurlZ + edgeLiftZ;
      }

      posAttr.setY(i, py);
      posAttr.setZ(i, pz);
    }

    geo.computeVertexNormals();
    return geo;
  }

  const paperMesh = new THREE.Mesh(createCurvedPaperGeometry(CONFIG.paperWidth), paperShaderMaterial);
  paperMesh.castShadow = true;
  paperMesh.receiveShadow = true;
  carriageGroup.add(paperMesh);

  function triggerNewSheetInsert() {
    clearPaperCanvas();
    sheetStatus = 'inserting';
    insertAnimProgress = 0.0;
    paperMesh.visible = true;
    paperUniforms.uFeedWave.value = 1.2;
    paperUniforms.uScrollV.value = 0.0;
  }

  function triggerPaperEject() {
    if (sheetStatus === 'removed' || sheetStatus === 'ejecting') return false;
    archiveCurrentCanvasIfInked();
    sheetStatus = 'ejecting';
    insertAnimProgress = 1.0;
    paperUniforms.uFeedWave.value = 1.3;
    return true;
  }

  function getExportSourceCanvas() {
    if (currentSheetHasInk) return paperCanvas;
    if (hasArchivedSheet) return lastArchivedCanvas;
    return paperCanvas;
  }

  function triggerLineFeedWave() {
    paperUniforms.uFeedWave.value = 1.05;
  }

  function updatePaper(dt, elapsedTotal) {
    paperUniforms.uTime.value = elapsedTotal;

    if (sheetStatus === 'inserting') {
      insertAnimProgress = Math.min(1.0, insertAnimProgress + dt * 1.45);
      const eased = 1.0 - Math.pow(1.0 - insertAnimProgress, 3.0);
      paperUniforms.uInsertProgress.value = eased;
      if (insertAnimProgress >= 1.0) {
        sheetStatus = 'seated';
      }
    } else if (sheetStatus === 'ejecting') {
      insertAnimProgress += dt * 2.2;
      paperUniforms.uInsertProgress.value = insertAnimProgress;
      if (insertAnimProgress >= 2.2) {
        sheetStatus = 'removed';
        paperMesh.visible = false;
      }
    }

    const stiffness = 175.0;
    const damping = 13.5;
    const force = (scrollVTarget - scrollVCurrent) * stiffness;
    scrollVVel = (scrollVVel + force * dt) * Math.exp(-damping * dt);
    scrollVCurrent += scrollVVel * dt;
    paperUniforms.uScrollV.value = scrollVCurrent;

    paperUniforms.uFeedWave.value *= Math.exp(-dt * 7.5);
  }

  return {
    paperMesh,
    paperCanvas,
    paperUniforms,
    stampCharacter,
    rollCanvasTextUpOneLine,
    scrollByLines,
    triggerNewSheetInsert,
    triggerPaperEject,
    getExportSourceCanvas,
    isSheetPresent: () => sheetStatus === 'seated' || sheetStatus === 'inserting',
    getSheetStatus: () => sheetStatus,
    getCurrentLine: () => Math.round(currentCanvasLine),
    triggerLineFeedWave,
    updatePaper
  };
}
