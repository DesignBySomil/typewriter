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
  paperTexture.flipY = true; // Upright standard WebGL orientation
  paperTexture.minFilter = THREE.LinearFilter;
  paperTexture.magFilter = THREE.LinearFilter;
  paperTexture.anisotropy = 4;

  // Ensure fonts are loaded so canvas text uses Courier Prime / Special Elite immediately
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      paperTexture.needsUpdate = true;
    });
  }

  /**
   * Stamps a character onto the upright paper CanvasTexture at the exact pixel coordinate
   * corresponding to `col` and `lineIndex` so it lines up 1:1 with the printing point at world X = 0.
   * Channel encoding:
   * - R: Black ribbon ink density
   * - G: Red ribbon ink density
   * - B: Total letterpress deboss depth
   */
  function stampCharacter(char, col, lineOffsetFromActive = 0, ribbonColor = 'black', absoluteLineId = 0) {
    const key = `${absoluteLineId}:${col}`;
    const prevStrikes = strikeGrid.get(key) || 0;
    strikeGrid.set(key, prevStrikes + 1);

    // Exact horizontal pixel center for column `col`
    const centerX = CONFIG.paperCol0PxX + col * CONFIG.paperCharPxX;
    const baselineY = CONFIG.paperActiveLineCanvasY - lineOffsetFromActive * CONFIG.paperLinePxY;

    // Subtle mechanical baseline jitter & ink density variation (darker on double-strike)
    const jitterX = (Math.random() - 0.5) * 1.8;
    const jitterY = (Math.random() - 0.5) * 2.4;
    const rotJitter = (Math.random() - 0.5) * 0.028;
    const baseDensity = Math.min(255, Math.floor(218 + Math.random() * 37 + prevStrikes * 35));

    const rVal = ribbonColor === 'black' ? baseDensity : 0;
    const gVal = ribbonColor === 'red'   ? baseDensity : 0;
    const bVal = baseDensity;

    paperCtx.save();
    paperCtx.globalCompositeOperation = 'lighter';
    paperCtx.translate(centerX + jitterX, baselineY + jitterY);
    paperCtx.rotate(rotJitter);

    paperCtx.font = 'bold 46px "Courier Prime", "Special Elite", "Courier New", Courier, monospace';
    paperCtx.textAlign = 'center';
    paperCtx.textBaseline = 'alphabetic';

    // Outer ink bleed halo
    paperCtx.shadowColor = `rgb(${Math.floor(rVal * 0.7)}, ${Math.floor(gVal * 0.7)}, ${Math.floor(bVal * 0.75)})`;
    paperCtx.shadowBlur = 2.5;
    paperCtx.fillStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
    paperCtx.fillText(char, 0, 0);

    // Crisp core letterpress impression
    paperCtx.shadowBlur = 0;
    paperCtx.fillText(char, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6);
    paperCtx.restore();

    paperTexture.needsUpdate = true;
  }

  /**
   * Shifts all existing canvas lines UP by one line (`paperLinePxY`) when the user performs a line feed,
   * so the active typing line always stays at `paperActiveLineCanvasY` (just above the platen printing point)
   * while already-typed lines visibly roll up the sheet!
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
    uLightDir: { value: new THREE.Vector3(6.0, 11.5, 8.0).normalize() }
  };

  const paperShaderMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: paperUniforms,
    vertexShader: PAPER_VERTEX_SHADER,
    fragmentShader: PAPER_FRAGMENT_SHADER
  });

  // Curved Paper Sheet Geometry wrapping around platen and rising up
  function createCurvedPaperGeometry(width, heightSegments = 64) {
    const geo = new THREE.PlaneGeometry(width, 1.0, 48, heightSegments);
    const posAttr = geo.attributes.position;
    const r = CONFIG.platenRadius + 0.02;

    for (let i = 0; i < posAttr.count; i++) {
      const u = posAttr.getY(i) + 0.5; // 0 (bottom under platen) -> 1 (top edge of sheet)
      let py = 0;
      let pz = 0;

      if (u < 0.24) {
        // Wrap around bottom-front of platen cylinder up to printing point (u = 0.24 is angle 0 at front)
        const t = u / 0.24;
        const angle = -Math.PI * 0.55 * (1.0 - t);
        py = Math.sin(angle) * r;
        pz = Math.cos(angle) * r;
      } else if (u < 0.34) {
        // Curve slightly back toward the paper bail & rear paper table
        const t = (u - 0.24) / 0.10;
        const angle = t * (Math.PI * 0.28);
        py = Math.sin(angle) * r;
        pz = Math.cos(angle) * r;
      } else {
        // Rise up along the tilted rear paper support table so typed lines are clearly visible
        const t = (u - 0.34) / 0.66;
        const baseAngle = Math.PI * 0.28;
        const startY = Math.sin(baseAngle) * r;
        const startZ = Math.cos(baseAngle) * r;
        const sheetLen = CONFIG.paperSheetHeight;
        py = startY + t * sheetLen * Math.cos(0.24);
        pz = startZ - t * sheetLen * Math.sin(0.24);
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

  let insertAnimProgress = 0.0; // Starts at 0 on load for cinematic paper slide-in

  function triggerNewSheetInsert() {
    clearPaperCanvas();
    insertAnimProgress = 0.0;
    paperUniforms.uFeedWave.value = 1.2;
  }

  function triggerLineFeedWave() {
    // Smoothly animate scroll offset & vertex wave when line-feeding
    paperUniforms.uScrollV.value = -(CONFIG.paperLinePxY / CONFIG.paperCanvasH);
    paperUniforms.uFeedWave.value = 1.0;
  }

  function updatePaper(dt, elapsedTotal) {
    paperUniforms.uTime.value = elapsedTotal;

    // Ease in paper insertion
    if (insertAnimProgress < 1.0) {
      insertAnimProgress = Math.min(1.0, insertAnimProgress + dt * 1.15);
      const eased = 1.0 - Math.pow(1.0 - insertAnimProgress, 3.0);
      paperUniforms.uInsertProgress.value = eased;
    }

    // Smoothly settle line-feed scroll offset to 0
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
