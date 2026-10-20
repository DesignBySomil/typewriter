import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PAPER_VERTEX_SHADER, PAPER_FRAGMENT_SHADER } from './shaders/paper.js';

export function createPaperSystem(carriageGroup) {
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = CONFIG.paperCanvasW;
  paperCanvas.height = CONFIG.paperCanvasH;
  const paperCtx = paperCanvas.getContext('2d');

  // Track strike counts per (line, col) so double-striking the same column makes the ink darker & deeper
  const strikeGrid = new Map();

  function clearPaperCanvas() {
    paperCtx.fillStyle = '#000000';
    paperCtx.fillRect(0, 0, paperCanvas.width, paperCanvas.height);
    strikeGrid.clear();
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
   * Stamps a large, dark, crisp typewriter glyph onto the 2048x2048 CanvasTexture:
   * - Darker core with a softer ink-bleed halo
   * - Slight uneven ribbon density per letter + tiny baseline jitter
   * - Channel encoding: R = Black ink, G = Red ink, B = Letterpress deboss heightfield
   */
  function stampCharacter(char, col, lineOffsetFromActive = 0, ribbonColor = 'black', absoluteLineId = 0) {
    const key = `${absoluteLineId}:${col}`;
    const prevStrikes = strikeGrid.get(key) || 0;
    strikeGrid.set(key, prevStrikes + 1);

    // Exact horizontal pixel center for column `col` (matches carriage world step 1:1)
    const centerX = CONFIG.paperCol0PxX + col * CONFIG.paperCharPxX;
    const baselineY = CONFIG.paperActiveLineCanvasY - lineOffsetFromActive * CONFIG.paperLinePxY;

    // Tiny typewriter baseline & angle jitter + slight per-letter ink variation
    const jitterX = (Math.random() - 0.5) * 2.0;
    const jitterY = (Math.random() - 0.5) * 2.8;
    const rotJitter = (Math.random() - 0.5) * 0.032;
    const baseDensity = Math.min(255, Math.floor(225 + Math.random() * 30 + prevStrikes * 35));

    const rVal = ribbonColor === 'black' ? baseDensity : 0;
    const gVal = ribbonColor === 'red'   ? baseDensity : 0;
    const bVal = baseDensity;

    paperCtx.save();
    paperCtx.globalCompositeOperation = 'lighter';
    paperCtx.translate(centerX + jitterX, baselineY + jitterY);
    paperCtx.rotate(rotJitter);

    // Large 64px bold monospace face (~1.6% of sheet height; crisp and legible at 1280x800)
    paperCtx.font = 'bold 64px "Courier Prime", "Special Elite", "Courier New", Courier, monospace';
    paperCtx.textAlign = 'center';
    paperCtx.textBaseline = 'alphabetic';

    // 1. Lighter ink-bleed halo around glyph
    paperCtx.shadowColor = `rgb(${Math.floor(rVal * 0.65)}, ${Math.floor(gVal * 0.65)}, ${Math.floor(bVal * 0.72)})`;
    paperCtx.shadowBlur = 4.5;
    paperCtx.fillStyle = `rgb(${Math.floor(rVal * 0.85)}, ${Math.floor(gVal * 0.85)}, ${Math.floor(bVal * 0.85)})`;
    paperCtx.fillText(char, 0, 0);

    // 2. Darker, heavier ink core with slight ribbon-weave micro-offset
    paperCtx.shadowBlur = 0;
    paperCtx.fillStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
    paperCtx.fillText(char, 0, 0);
    paperCtx.lineWidth = 1.6;
    paperCtx.strokeStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
    paperCtx.strokeText(char, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7);
    paperCtx.restore();

    paperTexture.needsUpdate = true;
  }

  /**
   * Shifts all existing canvas lines UP by one line (`paperLinePxY` = 74px) on line feed
   * so previous 10-12 lines remain clearly readable above the active typing line.
   */
  function rollCanvasTextUpOneLine() {
    const dy = CONFIG.paperLinePxY;
    const w = paperCanvas.width;
    const h = paperCanvas.height;
    const imageData = paperCtx.getImageData(0, dy, w, h - dy);
    paperCtx.fillStyle = '#000000';
    paperCtx.fillRect(0, 0, w, h);
    paperCtx.putImageData(imageData, 0, 0);
    paperTexture.needsUpdate = true;
  }

  const paperUniforms = {
    uTextMap: { value: paperTexture },
    uTime: { value: 0 },
    uScrollV: { value: 0.0 },
    uFeedWave: { value: 0.0 },
    uInsertProgress: { value: 0.0 },
    uLightDir: { value: new THREE.Vector3(5.8, 11.8, 8.2).normalize() }
  };

  const paperShaderMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: paperUniforms,
    vertexShader: PAPER_VERTEX_SHADER,
    fragmentShader: PAPER_FRAGMENT_SHADER
  });

  // Curved Hero Paper Sheet Geometry wrapping around platen and rising prominently
  function createCurvedPaperGeometry(width, heightSegments = 64) {
    const geo = new THREE.PlaneGeometry(width, 1.0, 48, heightSegments);
    const posAttr = geo.attributes.position;
    const r = CONFIG.platenRadius + 0.022;

    for (let i = 0; i < posAttr.count; i++) {
      const u = posAttr.getY(i) + 0.5; // 0 (bottom under platen) -> 1 (top edge of sheet)
      let py = 0;
      let pz = 0;

      if (u < 0.22) {
        // Wrap around bottom-front of platen cylinder up to printing point
        const t = u / 0.22;
        const angle = -Math.PI * 0.52 * (1.0 - t);
        py = Math.sin(angle) * r;
        pz = Math.cos(angle) * r;
      } else if (u < 0.30) {
        // Transition over the upper-front of the platen to `u = 0.30` (where the active typed line sits clearly in view)
        const t = (u - 0.22) / 0.08;
        const angle = t * (Math.PI * 0.21);
        py = Math.sin(angle) * r;
        pz = Math.cos(angle) * r;
      } else {
        // Rise up prominently at a gentle 18-degree angle facing the camera so all typed lines read clearly
        const t = (u - 0.30) / 0.70;
        const baseAngle = Math.PI * 0.21;
        const startY = Math.sin(baseAngle) * r;
        const startZ = Math.cos(baseAngle) * r;
        const sheetLen = CONFIG.paperSheetHeight;
        py = startY + t * sheetLen * Math.cos(0.20);
        pz = startZ - t * sheetLen * Math.sin(0.20);
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
  }

  function triggerLineFeedWave() {
    paperUniforms.uScrollV.value = -(CONFIG.paperLinePxY / CONFIG.paperCanvasH);
    paperUniforms.uFeedWave.value = 1.0;
  }

  function updatePaper(dt, elapsedTotal) {
    paperUniforms.uTime.value = elapsedTotal;

    if (insertAnimProgress < 1.0) {
      insertAnimProgress = Math.min(1.0, insertAnimProgress + dt * 1.35);
      const eased = 1.0 - Math.pow(1.0 - insertAnimProgress, 3.0);
      paperUniforms.uInsertProgress.value = eased;
    }

    paperUniforms.uScrollV.value *= Math.exp(-dt * 14.0);
    paperUniforms.uFeedWave.value *= Math.exp(-dt * 7.5);
  }

  return {
    paperMesh,
    paperUniforms,
    stampCharacter,
    rollCanvasTextUpOneLine,
    triggerNewSheetInsert,
    triggerLineFeedWave,
    updatePaper
  };
}
