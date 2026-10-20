import * as THREE from 'three';

/**
 * Deep glossy green-black or dark steel enamel material:
 * - Zero high-frequency pixel hash / moire (smooth derivative-filtered low-frequency variation only)
 * - Soft studio dome reflection gradient + crisp clearcoat specular streak from upper-left warm lamp
 */
export function createEnamelMaterial({
  baseColor = 0x0b1f17,
  fresnelTint = 0x529c80,
  roughness = 0.18,
  metalness = 0.18,
  clearcoatBoost = 1.45
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

         float smoothEnamelNoise(vec2 p) {
           vec2 i = floor(p);
           vec2 f = fract(p);
           vec2 u = f * f * (3.0 - 2.0 * f);
           float a = fract(sin(dot(i, vec2(27.1, 61.7))) * 4375.5);
           float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(27.1, 61.7))) * 4375.5);
           float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(27.1, 61.7))) * 4375.5);
           float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(27.1, 61.7))) * 4375.5);
           return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
         }`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 viewDirW = normalize(cameraPosition - vEnamelWorldPos);
         vec3 nW = normalize(vEnamelWorldNormal);
         float ndotv = clamp(dot(nW, viewDirW), 0.0, 1.0);
         float fresnel = pow(1.0 - ndotv, 2.7);

         // Smooth low-frequency coat variation attenuated by screen-space derivatives
         vec2 coatUv = vEnamelWorldPos.xz * 2.0;
         float fw = length(fwidth(coatUv));
         float fade = 1.0 - smoothstep(0.15, 0.65, fw);
         float lowWave = (smoothEnamelNoise(coatUv) - 0.5) * 0.022 * fade;

         // Soft studio dome reflection gradient
         vec3 refl = reflect(-viewDirW, nW);
         float envGrad = smoothstep(-0.35, 0.85, refl.y + lowWave);
         vec3 envCol = mix(vec3(0.04, 0.06, 0.07), uFresnelTint, envGrad);

         // Clearcoat specular streak from upper-left warm lamp + front studio fill
         vec3 lampDir = normalize(vec3(-8.5, 10.5, 4.8));
         vec3 fillDir = normalize(vec3(3.5, 9.0, 9.0));
         float ndoth1 = max(dot(nW, normalize(lampDir + viewDirW)), 0.0);
         float ndoth2 = max(dot(nW, normalize(fillDir + viewDirW)), 0.0);
         float coatStreak = (pow(ndoth1, 26.0) * 0.22 + pow(ndoth2, 32.0) * 0.16) * uClearcoatBoost;
         float coatCore   = (pow(ndoth1, 130.0) * 0.72 + pow(ndoth2, 140.0) * 0.45) * uClearcoatBoost;

         float skyLift = smoothstep(-0.2, 1.0, nW.y) * 0.085;

         gl_FragColor.rgb += envCol * (0.14 + fresnel * 0.66)
                           + uFresnelTint * skyLift
                           + vec3(1.0, 0.94, 0.84) * (coatStreak + coatCore);
         #include <dithering_fragment>`
      );
  };

  return mat;
}

/**
 * Brighter brushed chrome material with a crisp studio highlight line & faint chromatic reflection dispersion
 */
export function createChromeMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf5f2eb,
    roughness: 0.09,
    metalness: 0.94
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

         // Derivative-filtered subtle brushing
         float coord = vChromeWorldPos.x * 32.0 + rDir.y * 5.0;
         float fw = fwidth(coord);
         float brushFade = 1.0 - smoothstep(0.4, 1.8, fw);
         float aniso = sin(coord) * 0.035 * brushFade;

         float horizon = sin(rDir.y * 5.2 + rDir.x * 1.8) * 0.5 + 0.5 + aniso;
         vec3 studioSky = mix(vec3(0.24, 0.27, 0.32), vec3(1.0, 0.98, 0.92), smoothstep(0.18, 0.78, horizon));

         // Faint chromatic dispersion reflection line along the chrome trim
         vec3 lampDir = normalize(vec3(-7.5, 10.5, 6.0));
         vec3 halfVec = normalize(lampDir + vDir);
         float specAngle = max(dot(nDir, halfVec), 0.0);
         float specR = pow(clamp(specAngle + 0.0045, 0.0, 1.0), 110.0);
         float specG = pow(specAngle, 110.0);
         float specB = pow(clamp(specAngle - 0.0045, 0.0, 1.0), 110.0);
         vec3 chromaticLine = vec3(specR * 1.08, specG * 0.98, specB * 1.15) * 0.92;

         // Secondary subtle rainbow dispersion band on grazing reflection
         float chromaBand = rDir.y * 8.0 + rDir.x * 2.5;
         vec3 prismTint = vec3(
           smoothstep(0.35, 0.75, sin(chromaBand + 0.35)),
           smoothstep(0.35, 0.75, sin(chromaBand)),
           smoothstep(0.35, 0.75, sin(chromaBand - 0.35))
         ) * 0.14;

         float fres = pow(1.0 - clamp(dot(nDir, vDir), 0.0, 1.0), 2.0);

         gl_FragColor.rgb = mix(gl_FragColor.rgb, studioSky + prismTint, 0.56 + fres * 0.35) + chromaticLine;
         #include <dithering_fragment>`
      );
  };

  return mat;
}
