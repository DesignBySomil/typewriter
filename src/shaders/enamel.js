import * as THREE from 'three';

/**
 * Creates a deep green-black or dark steel enamel material with custom GLSL hooks:
 * - Fresnel studio gradient reflection (so dark surfaces never crush to flat black)
 * - Clearcoat specular highlight
 * - Subtle brushed micro-scratches & crinkle-enamel metallic flake
 */
export function createEnamelMaterial({
  baseColor = 0x11261e,
  fresnelTint = 0x52967c,
  roughness = 0.26,
  metalness = 0.24,
  clearcoatBoost = 1.25
} = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness
  });

  const fTint = new THREE.Color(fresnelTint);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFresnelTint = { value: fTint };
    shader.uniforms.uClearcoatBoost = { value: clearcoatBoost };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vEnamelWorldPos;
         varying vec3 vEnamelWorldNormal;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vEnamelWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vEnamelWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uFresnelTint;
         uniform float uClearcoatBoost;
         varying vec3 vEnamelWorldPos;
         varying vec3 vEnamelWorldNormal;

         float enamelHash(vec2 p) {
           return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
         }`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 viewDirW = normalize(cameraPosition - vEnamelWorldPos);
         vec3 nW = normalize(vEnamelWorldNormal);
         float ndotv = clamp(dot(nW, viewDirW), 0.0, 1.0);
         float fresnel = pow(1.0 - ndotv, 2.8);

         // Rich studio dome gradient reflection so dark body contours always read clearly
         vec3 refl = reflect(-viewDirW, nW);
         float envGrad = smoothstep(-0.4, 0.85, refl.y);
         vec3 envCol = mix(vec3(0.06, 0.08, 0.09), uFresnelTint, envGrad);

         // Warm key light + front fill clearcoat specular highlights
         vec3 keyDir = normalize(vec3(5.5, 11.0, 8.0));
         vec3 halfVec = normalize(keyDir + viewDirW);
         float coatSpec = pow(max(dot(nW, halfVec), 0.0), 84.0) * 0.65 * uClearcoatBoost;

         // Subtle micro-scratches & enamel crinkle grain
         float scratch = sin(vEnamelWorldPos.x * 95.0 + vEnamelWorldPos.z * 45.0) * 0.5 + 0.5;
         float micro = enamelHash(floor(vEnamelWorldPos.xz * 130.0));
         float flake = smoothstep(0.90, 1.0, micro) * 0.045 + scratch * 0.015;

         // Upward-facing studio sky lift
         float skyLift = max(0.0, nW.y) * 0.065;

         gl_FragColor.rgb += envCol * (0.14 + fresnel * 0.62) + uFresnelTint * skyLift + vec3(1.0, 0.95, 0.86) * (coatSpec + flake);
         #include <dithering_fragment>`
      );
  };

  return mat;
}

/**
 * High-contrast brushed chrome material with anisotropic-like studio horizon bands
 */
export function createChromeMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xeae6df,
    roughness: 0.13,
    metalness: 0.92
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vChromeWorldPos;
         varying vec3 vChromeWorldNormal;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vChromeWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vChromeWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vChromeWorldPos;
         varying vec3 vChromeWorldNormal;`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 vDir = normalize(cameraPosition - vChromeWorldPos);
         vec3 nDir = normalize(vChromeWorldNormal);
         vec3 rDir = reflect(-vDir, nDir);

         // Anisotropic brushed metal bands + studio softbox reflection
         float aniso = sin(vChromeWorldPos.x * 120.0 + rDir.y * 9.0) * 0.06;
         float horizon = sin(rDir.y * 6.5 + rDir.x * 2.2) * 0.5 + 0.5 + aniso;
         vec3 studioSky = mix(vec3(0.18, 0.21, 0.25), vec3(1.0, 0.95, 0.86), smoothstep(0.20, 0.82, horizon));
         float fres = pow(1.0 - clamp(dot(nDir, vDir), 0.0, 1.0), 2.2);

         gl_FragColor.rgb = mix(gl_FragColor.rgb, studioSky, 0.48 + fres * 0.35);
         #include <dithering_fragment>`
      );
  };

  return mat;
}
