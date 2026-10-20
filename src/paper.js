import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PAPER_VERTEX_SHADER, PAPER_FRAGMENT_SHADER } from './shaders/paper.js';

export function createPaperSystem(carriageGroup) {
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = CONFIG.paperCanvasW;
  paperCanvas.height = CONFIG.paperCanvasH;
  const paperCtx = paperCanvas.getContext('2d');

  const strikeGrid = new Map();

  // Page reads top to bottom: line n sits LOWER on the canvas than line n-1.
  // Carriage return rolls the paper UP, so earlier lines move up and the new line is below them.
  const LINE0_Y = 250;
  const MAX_LINE = Math.floor((1990 - LINE0_Y) / CONFIG.paperLinePxY);
  const V_PRINT = 0.0967; // texture v the shader shows at the strike line when scroll is 0
  const vOfLine = (n) => 1.0 - (LINE0_Y + n * CONFIG.paperLinePxY) / CONFIG.paperCanvasH;
  const scrollForLine = (n) => vOfLine(n) - V_PRINT;

  let currentCanvasLine = 0;
  let scrollVCurrent = scrollForLine(0);
  let scrollVTarget = scrollForLine(0);
  let scrollVVel = 0.0;

  function clearPaperCanvas() {
    paperCtx.fillStyle = '#000000';
    paperCtx.fillRect(0, 0, paperCanvas.width, paperCanvas.height);
    strikeGrid.clear();
    currentCanvasLine = 0;
    scrollVCurrent = scrollForLine(0);
    scrollVTarget = scrollForLine(0);
    scrollVVel = 0.0;
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
   * Stamps a typewriter glyph onto the 2048x2048 CanvasTexture,
   * complete with ribbon ink halo, heavier core, and 3-6 tiny ink spatter specks around the letter.
   */
  function stampCharacter(char, col, _unusedOffset = 0, ribbonColor = 'black', absoluteLineId = 0) {
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

    const baselineY = LINE0_Y + currentCanvasLine * CONFIG.paperLinePxY;

    const jitterX = (Math.random() - 0.5) * 2.0;
    const jitterY = (Math.random() - 0.5) * 2.8;
    const rotJitter = (Math.random() - 0.5) * 0.032;
    const baseDensity = Math.min(255, Math.floor(228 + Math.random() * 27 + prevStrikes * 35));

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

    // 1. Lighter ink-bleed halo around glyph
    paperCtx.shadowColor = `rgb(${Math.floor(rVal * 0.65)}, ${Math.floor(gVal * 0.65)}, ${Math.floor(bVal * 0.72)})`;
    paperCtx.shadowBlur = 4.5;
    paperCtx.fillStyle = `rgb(${Math.floor(rVal * 0.85)}, ${Math.floor(gVal * 0.85)}, ${Math.floor(bVal * 0.85)})`;
    paperCtx.fillText(char, 0, 0);

    // 2. Darker, heavier ink core
    paperCtx.shadowBlur = 0;
    paperCtx.fillStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
    paperCtx.fillText(char, 0, 0);
    paperCtx.lineWidth = 1.8;
    paperCtx.strokeStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
    paperCtx.strokeText(char, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7);

    // 3. A few tiny microscopic ink specks / ribbon spatter dots near the struck letter
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

    paperCtx.restore();
    paperTexture.needsUpdate = true;
  }

  function rollCanvasTextUpOneLine() {
    const lineStepV = CONFIG.paperLinePxY / CONFIG.paperCanvasH;

    if (currentCanvasLine >= MAX_LINE) {
      // Page is full on the canvas: slide the written text up, keep striking at the bottom line.
      const dy = CONFIG.paperLinePxY;
      const w = paperCanvas.width;
      const h = paperCanvas.height;
      const imageData = paperCtx.getImageData(0, dy, w, h - dy);
      paperCtx.fillStyle = '#000000';
      paperCtx.fillRect(0, 0, w, h);
      paperCtx.putImageData(imageData, 0, 0);
      paperTexture.needsUpdate = true;
      scrollVCurrent += lineStepV; // content jumped up one line; spring eases the view back
    } else {
      currentCanvasLine++;
    }

    scrollVTarget = scrollForLine(currentCanvasLine);
    scrollVVel -= lineStepV * 4.8;
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

  let insertAnimProgress = 0.0;

  function triggerNewSheetInsert() {
    clearPaperCanvas();
    insertAnimProgress = 0.0;
    paperUniforms.uFeedWave.value = 1.2;
    paperUniforms.uScrollV.value = 0.0;
  }

  function triggerLineFeedWave() {
    paperUniforms.uFeedWave.value = 1.05;
  }

  function updatePaper(dt, elapsedTotal) {
    paperUniforms.uTime.value = elapsedTotal;

    if (insertAnimProgress < 1.0) {
      insertAnimProgress = Math.min(1.0, insertAnimProgress + dt * 1.35);
      const eased = 1.0 - Math.pow(1.0 - insertAnimProgress, 3.0);
      paperUniforms.uInsertProgress.value = eased;
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
    triggerNewSheetInsert,
    triggerLineFeedWave,
    updatePaper
  };
}
