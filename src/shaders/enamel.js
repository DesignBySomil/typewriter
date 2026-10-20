import * as THREE from 'three';

// Cached procedural canvas maps so they are generated once and shared cleanly across materials
let cachedCrinkleBundle = null;
let cachedNickelBundle = null;

/**
 * Generates seamless 512x512 procedural CanvasTextures for:
 * - normalMap (fine orange-peel / crinkle paint micro-normal)
 * - roughnessMap (matte 0.70 - 0.90 base with fingerprint smudge patches & micro-scratches)
 * - bumpMap (fine hammertone dimples, scratches & chipped corner wear)
 */
function getCrinkleTextureBundle() {
  if (cachedCrinkleBundle) return cachedCrinkleBundle;

  const size = 512;
  const heightData = new Float32Array(size * size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  const normCanvas = document.createElement('canvas');
  normCanvas.width = size;
  normCanvas.height = size;
  const nCtx = normCanvas.getContext('2d');

  // Tileable multi-octave value noise helper
  function hash(ix, iy) {
    const x = ((ix % 64) + 64) % 64;
    const y = ((iy % 64) + 64) % 64;
    return Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
  }

  function smoothNoise(x, y, freq) {
    const fx = (x / size) * freq;
    const fy = (y / size) * freq;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const ux = fx - ix;
    const uy = fy - iy;
    const sx = ux * ux * (3 - 2 * ux);
    const sy = uy * uy * (3 - 2 * uy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  }

  const rImg = rCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Fine crinkle / orange-peel height + subtle smudge variation
      const n1 = smoothNoise(x, y, 48);
      const n2 = smoothNoise(x + 37, y + 91, 96);
      const smudge = smoothNoise(x, y, 8);
      const h = n1 * 0.62 + n2 * 0.38;
      heightData[y * size + x] = h;

      const idx = (y * size + x) * 4;
      // High roughness (200..248 out of 255 -> ~0.78..0.97)
      const rVal = Math.min(252, Math.max(195, Math.floor(212 + (smudge - 0.5) * 36 + (h - 0.5) * 18)));
      rImg.data[idx] = rVal;
      rImg.data[idx + 1] = rVal;
      rImg.data[idx + 2] = rVal;
      rImg.data[idx + 3] = 255;

      const bVal = Math.floor(h * 255);
      bImg.data[idx] = bVal;
      bImg.data[idx + 1] = bVal;
      bImg.data[idx + 2] = bVal;
      bImg.data[idx + 3] = 255;
    }
  }
  rCtx.putImageData(rImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  // Add subtle micro-scratches & fingerprint smudge ellipses onto bump & roughness maps
  bCtx.strokeStyle = 'rgba(40, 40, 40, 0.32)';
  rCtx.strokeStyle = 'rgba(250, 250, 250, 0.28)';
  for (let i = 0; i < 42; i++) {
    const sx = (hash(i, 11) * size);
    const sy = (hash(i, 29) * size);
    const ang = hash(i, 47) * Math.PI * 2;
    const len = 8 + hash(i, 61) * 26;
    bCtx.lineWidth = 0.8;
    bCtx.beginPath();
    bCtx.moveTo(sx, sy);
    bCtx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
    bCtx.stroke();

    rCtx.lineWidth = 1.0;
    rCtx.beginPath();
    rCtx.moveTo(sx, sy);
    rCtx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
    rCtx.stroke();
  }

  // Subtle dull fingerprint smudge patches on roughness canvas
  for (let i = 0; i < 14; i++) {
    const fx = hash(i, 101) * size;
    const fy = hash(i, 131) * size;
    const rad = 18 + hash(i, 163) * 32;
    const grad = rCtx.createRadialGradient(fx, fy, 2, fx, fy, rad);
    grad.addColorStop(0, 'rgba(242, 242, 242, 0.22)');
    grad.addColorStop(1, 'rgba(242, 242, 242, 0.0)');
    rCtx.fillStyle = grad;
    rCtx.beginPath();
    rCtx.arc(fx, fy, rad, 0, Math.PI * 2);
    rCtx.fill();
  }

  // Compute tangent-space normal map from heightData
  const nImg = nCtx.createImageData(size, size);
  const strength = 2.4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xL = (x - 1 + size) % size;
      const xR = (x + 1) % size;
      const yD = (y - 1 + size) % size;
      const yU = (y + 1) % size;

      const dX = (heightData[y * size + xR] - heightData[y * size + xL]) * strength;
      const dY = (heightData[yU * size + x] - heightData[yD * size + x]) * strength;
      const invLen = 1.0 / Math.sqrt(dX * dX + dY * dY + 1.0);

      const idx = (y * size + x) * 4;
      nImg.data[idx]     = Math.floor(((-dX * invLen) * 0.5 + 0.5) * 255);
      nImg.data[idx + 1] = Math.floor(((-dY * invLen) * 0.5 + 0.5) * 255);
      nImg.data[idx + 2] = Math.floor(((1.0 * invLen) * 0.5 + 0.5) * 255);
      nImg.data[idx + 3] = 255;
    }
  }
  nCtx.putImageData(nImg, 0, 0);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const normalMap = new THREE.CanvasTexture(normCanvas);

  [roughnessMap, bumpMap, normalMap].forEach((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
  });

  cachedCrinkleBundle = { roughnessMap, bumpMap, normalMap };
  return cachedCrinkleBundle;
}

/**
 * Generates procedural pitting, brushed patina, and roughness maps for Oxidized Satin Nickel
 */
function getNickelTextureBundle() {
  if (cachedNickelBundle) return cachedNickelBundle;

  const size = 256;
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  rCtx.fillStyle = '#9c9c9c';
  rCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Fine horizontal satin grain + oxidised dark pitting specks
  for (let y = 0; y < size; y++) {
    const streak = Math.floor(145 + Math.sin(y * 1.7) * 18);
    rCtx.fillStyle = `rgb(${streak}, ${streak}, ${streak})`;
    rCtx.fillRect(0, y, size, 1);
  }

  for (let i = 0; i < 220; i++) {
    const px = (Math.abs(Math.sin(i * 73.1)) * size) % size;
    const py = (Math.abs(Math.cos(i * 139.7)) * size) % size;
    const rad = 0.8 + (i % 3) * 0.9;
    rCtx.fillStyle = 'rgba(230, 230, 230, 0.55)';
    rCtx.beginPath();
    rCtx.arc(px, py, rad, 0, Math.PI * 2);
    rCtx.fill();

    bCtx.fillStyle = 'rgba(25, 25, 25, 0.65)';
    bCtx.beginPath();
    bCtx.arc(px, py, rad, 0, Math.PI * 2);
    bCtx.fill();
  }

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  [roughnessMap, bumpMap].forEach((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
  });

  cachedNickelBundle = { roughnessMap, bumpMap };
  return cachedNickelBundle;
}

/**
 * Zero-Gloss Matte Crinkle Paint Material (Olivetti Lettera 32 Shell, Cheeks, Top Cover, Spacebar):
 * - metalness: 0.0 (pure matte/satin pigment paint, zero metallic sheen)
 * - roughness: 0.72 - 0.88 with canvas roughnessMap, normalMap & bumpMap
 * - envMapIntensity: 0.14 (no glossy environment reflection)
 * - Subtle edge chipping showing dull bare cast aluminum + dust in recessed creases
 */
export function createEnamelMaterial({
  baseColor = 0x6c7c78,
  metalTint = 0x868c8a,
  roughness = 0.78,
  metalness = 0.0
} = {}) {
  const { roughnessMap, bumpMap, normalMap } = getCrinkleTextureBundle();

  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness: 0.0, // Strictly 0 for painted/plastic surfaces
    roughnessMap,
    normalMap,
    normalScale: new THREE.Vector2(0.28, 0.28),
    bumpMap,
    bumpScale: 0.012,
    envMapIntensity: 0.14
  });

  const mTint = new THREE.Color(metalTint);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMetalTint = { value: mTint };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vPaintWorldPos;
         varying vec3 vPaintWorldNormal;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vPaintWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vPaintWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uMetalTint;
         varying vec3 vPaintWorldPos;
         varying vec3 vPaintWorldNormal;

         float lowNoise(vec2 p) {
           vec2 i = floor(p);
           vec2 f = fract(p);
           vec2 u = f * f * (3.0 - 2.0 * f);
           float a = fract(sin(dot(i, vec2(27.1, 61.7))) * 4375.5453);
           float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(27.1, 61.7))) * 4375.5453);
           float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(27.1, 61.7))) * 4375.5453);
           float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(27.1, 61.7))) * 4375.5453);
           return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
         }`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 nW = normalize(vPaintWorldNormal);

         // Chipped edges along sharp corners revealing dull bare grey metal (zero shine)
         float bevelCurvature = length(fwidth(nW));
         float chipNoise = smoothstep(0.35, 0.75, lowNoise(vPaintWorldPos.xz * 7.5 + vPaintWorldPos.xy * 5.0));
         float edgeWear = smoothstep(0.09, 0.28, bevelCurvature) * chipNoise * 0.38;
         gl_FragColor.rgb = mix(gl_FragColor.rgb, uMetalTint * 0.45, edgeWear);

         // Darkened ambient occlusion in low creases + subtle matte dust in upward pockets
         float creaseAO = smoothstep(0.15, 1.35, vPaintWorldPos.y) * 0.16 + 0.84;
         float dustMask = smoothstep(1.9, 0.45, vPaintWorldPos.y) * max(0.0, nW.y) * lowNoise(vPaintWorldPos.xz * 3.2);
         gl_FragColor.rgb *= creaseAO;
         gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.42, 0.39, 0.35), dustMask * 0.12);
         #include <dithering_fragment>`
      );
  };

  return mat;
}

/**
 * Oxidized Satin Nickel Material (Metals: roughness 0.54, metalness 0.80, dark patina & pitting, zero mirror shine)
 */
export function createChromeMaterial() {
  const { roughnessMap, bumpMap } = getNickelTextureBundle();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xb8b2a6,
    roughness: 0.54,
    metalness: 0.80,
    roughnessMap,
    bumpMap,
    bumpScale: 0.008,
    envMapIntensity: 0.24
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vNickelWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vNickelWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vNickelWorldPos;
         float patNoise(vec2 p) {
           vec2 i = floor(p);
           vec2 f = fract(p);
           vec2 u = f * f * (3.0 - 2.0 * f);
           float a = fract(sin(dot(i, vec2(41.1, 83.7))) * 4375.5);
           float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(41.1, 83.7))) * 4375.5);
           float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(41.1, 83.7))) * 4375.5);
           float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(41.1, 83.7))) * 4375.5);
           return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
         }`
      )
      .replace(
        '#include <dithering_fragment>',
        `// Darkened oxidized patina and fine pitting
         float patina = patNoise(vNickelWorldPos.xz * 9.0 + vNickelWorldPos.xy * 6.0);
         gl_FragColor.rgb *= (0.78 + patina * 0.22);
         #include <dithering_fragment>`
      );
  };

  return mat;
}
