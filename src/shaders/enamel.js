import * as THREE from 'three';

let cachedCrinkleBundle = null;
let cachedNickelBundle = null;

/**
 * Generates seamless 512x512 procedural CanvasTextures for:
 * - normalMap (fine orange-peel / crinkle paint micro-normal)
 * - roughnessMap (matte 0.64 - 0.92 with uneven paint sheen, smudges & micro-scratches)
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
      const n1 = smoothNoise(x, y, 48);
      const n2 = smoothNoise(x + 37, y + 91, 96);
      const smudge = smoothNoise(x, y, 6);
      const sheenPatch = smoothNoise(x + 113, y + 53, 14);
      const h = n1 * 0.62 + n2 * 0.38;
      heightData[y * size + x] = h;

      const idx = (y * size + x) * 4;
      // Uneven matte paint sheen (168..244 out of 255 -> roughness ~0.65..0.95)
      const rVal = Math.min(
        246,
        Math.max(166, Math.floor(206 + (smudge - 0.5) * 48 + (sheenPatch - 0.5) * 32 + (h - 0.5) * 18))
      );
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

  // Micro-scratches & handling wear lines
  bCtx.strokeStyle = 'rgba(35, 35, 35, 0.36)';
  rCtx.strokeStyle = 'rgba(250, 250, 250, 0.32)';
  for (let i = 0; i < 52; i++) {
    const sx = hash(i, 11) * size;
    const sy = hash(i, 29) * size;
    const ang = hash(i, 47) * Math.PI * 2;
    const len = 8 + hash(i, 61) * 28;
    bCtx.lineWidth = 0.8;
    bCtx.beginPath();
    bCtx.moveTo(sx, sy);
    bCtx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
    bCtx.stroke();

    rCtx.lineWidth = 1.1;
    rCtx.beginPath();
    rCtx.moveTo(sx, sy);
    rCtx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
    rCtx.stroke();
  }

  // Fingerprint / palm smudge patches on roughness canvas
  for (let i = 0; i < 18; i++) {
    const fx = hash(i, 101) * size;
    const fy = hash(i, 131) * size;
    const rad = 20 + hash(i, 163) * 36;
    const grad = rCtx.createRadialGradient(fx, fy, 2, fx, fy, rad);
    grad.addColorStop(0, 'rgba(244, 244, 244, 0.26)');
    grad.addColorStop(1, 'rgba(244, 244, 244, 0.0)');
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

  for (let y = 0; y < size; y++) {
    const streak = Math.floor(148 + Math.sin(y * 1.7) * 18);
    rCtx.fillStyle = `rgb(${streak}, ${streak}, ${streak})`;
    rCtx.fillRect(0, y, size, 1);
  }

  for (let i = 0; i < 240; i++) {
    const px = (Math.abs(Math.sin(i * 73.1)) * size) % size;
    const py = (Math.abs(Math.cos(i * 139.7)) * size) % size;
    const rad = 0.8 + (i % 3) * 0.9;
    rCtx.fillStyle = 'rgba(232, 232, 232, 0.55)';
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
 * Zero-Gloss Matte Crinkle Paint Material:
 * - Uneven paint sheen (roughness 0.65 - 0.90)
 * - Darker accumulated grime near the key deck edges & inner cheeks
 * - Subtle corner chips showing dull bare cast aluminum + dust in creases
 */
export function createEnamelMaterial({
  baseColor = 0x6b7b77,
  metalTint = 0x868c8a,
  roughness = 0.78,
  metalness = 0.0
} = {}) {
  const { roughnessMap, bumpMap, normalMap } = getCrinkleTextureBundle();

  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness: 0.0,
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

         // Slightly uneven paint sheen / tonal mottling across the cast shell
         float sheenVar = (lowNoise(vPaintWorldPos.xz * 1.6) - 0.5) * 0.05;
         gl_FragColor.rgb += sheenVar * gl_FragColor.rgb;

         // Darker accumulated grime near the key deck edges (X near ±4.4, Z between 1.6 and 4.6, Y between 0.4 and 1.9)
         float deckEdgeX = smoothstep(3.3, 4.75, abs(vPaintWorldPos.x));
         float deckZoneZ = smoothstep(1.2, 2.0, vPaintWorldPos.z) * smoothstep(4.8, 4.1, vPaintWorldPos.z);
         float deckZoneY = smoothstep(2.1, 1.35, vPaintWorldPos.y);
         float grimeNoise = lowNoise(vPaintWorldPos.xz * 6.5);
         float deckGrime = deckEdgeX * deckZoneZ * deckZoneY * (0.45 + 0.55 * grimeNoise);
         gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.11, 0.12, 0.11), deckGrime * 0.38);

         // Subtle chips on shell corners & sharp bevels showing dull bare cast aluminum
         float bevelCurvature = length(fwidth(nW));
         float cornerMask = smoothstep(3.8, 4.9, abs(vPaintWorldPos.x)) * smoothstep(2.0, 4.6, abs(vPaintWorldPos.z));
         float chipNoise = smoothstep(0.32, 0.72, lowNoise(vPaintWorldPos.xz * 8.5 + vPaintWorldPos.xy * 6.0));
         float edgeWear = (smoothstep(0.08, 0.26, bevelCurvature) + cornerMask * 0.25) * chipNoise * 0.42;
         gl_FragColor.rgb = mix(gl_FragColor.rgb, uMetalTint * 0.46, clamp(edgeWear, 0.0, 0.48));

         // Darkened ambient occlusion in low creases + subtle matte dust in upward pockets
         float creaseAO = smoothstep(0.15, 1.35, vPaintWorldPos.y) * 0.16 + 0.84;
         float dustMask = smoothstep(1.9, 0.45, vPaintWorldPos.y) * max(0.0, nW.y) * lowNoise(vPaintWorldPos.xz * 3.2);
         gl_FragColor.rgb *= creaseAO;
         gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.44, 0.41, 0.36), dustMask * 0.14);
         #include <dithering_fragment>`
      );
  };

  return mat;
}

/**
 * Oxidized Satin Nickel Material (Metals: roughness 0.54, metalness 0.80, dark patina & pitting)
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
        `float patina = patNoise(vNickelWorldPos.xz * 9.0 + vNickelWorldPos.xy * 6.0);
         gl_FragColor.rgb *= (0.78 + patina * 0.22);
         #include <dithering_fragment>`
      );
  };

  return mat;
}
