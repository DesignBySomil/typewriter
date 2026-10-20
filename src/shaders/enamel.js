import * as THREE from 'three';

/**
 * Photorealistic Matte/Satin Crinkle & Hammertone Paint Material (Olivetti Lettera 32):
 * - Roughness 0.58 - 0.72 (no glossy plastic look, no sharp specular streaks)
 * - Smooth procedural orange-peel / crinkle micro-normal perturbation (derivative-filtered, zero moire)
 * - Subtle corner/edge wear revealing dull underlying cast aluminum
 * - Faint low-frequency dust in recessed creases & subtle hand smudges on top cover
 */
export function createEnamelMaterial({
  baseColor = 0x6d7f7c,   // Authentic 1963 Olivetti Lettera 32 muted sage/celadon slate-grey-green
  metalTint = 0x9aa4a2,   // Dull worn aluminum undercoat on edges
  roughness = 0.64,
  metalness = 0.14
} = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness,
    envMapIntensity: 0.45
  });

  const mTint = new THREE.Color(metalTint);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMetalTint = { value: mTint };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vPaintWorldPos;
         varying vec3 vPaintLocalPos;
         varying vec3 vPaintWorldNormal;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vPaintLocalPos = transformed;
         vPaintWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vPaintWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uMetalTint;
         varying vec3 vPaintWorldPos;
         varying vec3 vPaintLocalPos;
         varying vec3 vPaintWorldNormal;

         // Smooth 2D value noise (no per-pixel dithering)
         float vNoise(vec2 p) {
           vec2 i = floor(p);
           vec2 f = fract(p);
           vec2 u = f * f * (3.0 - 2.0 * f);
           float a = fract(sin(dot(i, vec2(27.1, 61.7))) * 4375.5453);
           float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(27.1, 61.7))) * 4375.5453);
           float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(27.1, 61.7))) * 4375.5453);
           float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(27.1, 61.7))) * 4375.5453);
           return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
         }

         float crinkleField(vec2 p) {
           return vNoise(p) * 0.65 + vNoise(p * 2.1 + vec2(4.3, 1.9)) * 0.35;
         }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         // Large-scale subtle smudge / fingerprint roughness variation (0.56 - 0.74)
         float smudge = vNoise(vPaintWorldPos.xz * 1.15) * 0.6 + vNoise(vPaintWorldPos.xy * 2.4) * 0.4;
         roughnessFactor = clamp(roughnessFactor + (smudge - 0.5) * 0.16, 0.54, 0.76);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         // Procedural orange-peel / crinkle micro-normal with fwidth derivative attenuation
         vec2 crinkleUv = vPaintWorldPos.xz * 26.0 + vPaintWorldPos.xy * 18.0;
         float fw = length(fwidth(crinkleUv));
         float bumpFade = 1.0 - smoothstep(0.35, 1.35, fw);
         float eps = 0.06;
         float h0 = crinkleField(crinkleUv);
         float hx = crinkleField(crinkleUv + vec2(eps, 0.0));
         float hy = crinkleField(crinkleUv + vec2(0.0, eps));
         vec3 crinklePerturb = vec3((h0 - hx), 0.0, (h0 - hy)) * 0.28 * bumpFade;
         normal = normalize(normal + crinklePerturb);`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 nW = normalize(vPaintWorldNormal);
         // Subtle edge wear along steep bevels/corners revealing dull cast metal
         float bevelCurvature = length(fwidth(nW));
         float edgeWear = smoothstep(0.08, 0.28, bevelCurvature) * vNoise(vPaintWorldPos.xz * 6.0) * 0.28;
         gl_FragColor.rgb = mix(gl_FragColor.rgb, uMetalTint * 0.42, edgeWear);

         // Subtle dust accumulation in low creases & recessed horizontal pockets
         float creaseFactor = smoothstep(1.8, 0.5, vPaintWorldPos.y) * max(0.0, nW.y);
         float dustNoise = vNoise(vPaintWorldPos.xz * 3.5);
         gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.42, 0.40, 0.36), creaseFactor * dustNoise * 0.08);
         #include <dithering_fragment>`
      );
  };

  return mat;
}

/**
 * Aged Satin Nickel / Brushed Aluminum Material (replaces mirror-like chrome):
 * - Roughness 0.34, slightly warm silver-nickel tone
 * - Subtle patina / micro-pitting and a soft broad highlight
 */
export function createChromeMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd6d1c7,
    roughness: 0.35,
    metalness: 0.82,
    envMapIntensity: 0.65
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vNickelWorldPos;
         varying vec3 vNickelWorldNormal;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vNickelWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vNickelWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vNickelWorldPos;
         varying vec3 vNickelWorldNormal;

         float nickelNoise(vec2 p) {
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
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float patina = nickelNoise(vNickelWorldPos.xz * 14.0);
         roughnessFactor = clamp(0.32 + patina * 0.10, 0.30, 0.44);`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 vDir = normalize(cameraPosition - vNickelWorldPos);
         vec3 nDir = normalize(vNickelWorldNormal);

         // Soft broad satin highlight from upper-left softbox (never mirror-like or neon)
         vec3 softboxDir = normalize(vec3(-7.5, 10.5, 5.5));
         float broadSpec = pow(max(dot(nDir, normalize(softboxDir + vDir)), 0.0), 14.0) * 0.16;
         float pitting = (nickelNoise(vNickelWorldPos.xz * 28.0) - 0.5) * 0.03;

         gl_FragColor.rgb += vec3(0.96, 0.93, 0.86) * broadSpec + pitting;
         #include <dithering_fragment>`
      );
  };

  return mat;
}
