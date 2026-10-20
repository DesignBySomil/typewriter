import * as THREE from 'three';
import { CONFIG } from './config.js';
import { BACKGROUND_VERTEX_SHADER, BACKGROUND_FRAGMENT_SHADER } from './shaders/background.js';

export function createSceneSystem(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);

  // 1. Full-Screen Background Shader (Studio Vignette + Film Grain + Floating Dust)
  const bgScene = new THREE.Scene();
  const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bgUniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  };

  const bgMaterial = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: bgUniforms,
    vertexShader: BACKGROUND_VERTEX_SHADER,
    fragmentShader: BACKGROUND_FRAGMENT_SHADER
  });
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMaterial));

  // 2. Main 3D Scene & Camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 120);

  // 3. Studio Lighting (Lifted hemisphere + warm key + cool rim + soft front fill)
  const hemiLight = new THREE.HemisphereLight(0xfff2dc, 0x3a4b54, 1.18);
  hemiLight.position.set(0, 12, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffe4c4, 2.65);
  keyLight.position.set(5.8, 11.8, 8.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 2.0;
  keyLight.shadow.camera.far = 32.0;
  const d = 9.0;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.radius = 2.6;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x88d0ec, 1.55);
  rimLight.position.set(-8.0, 7.2, -7.0);
  scene.add(rimLight);

  const frontFill = new THREE.DirectionalLight(0xffeedd, 1.08);
  frontFill.position.set(0.0, 5.2, 11.5);
  scene.add(frontFill);

  const basketLight = new THREE.PointLight(0xffb86c, 1.25, 9.5);
  basketLight.position.set(0, 3.1, 1.1);
  scene.add(basketLight);

  // 4. Dark, Low-Contrast, Fine-Grained Walnut Tabletop with Warm Pool & Under-Foot AO
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x160f0a,
    roughness: 0.74,
    metalness: 0.04
  });
  tableMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorldPosTable;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvWorldPosTable = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPosTable;
         float tblHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
         float tblNoise(vec2 p) {
           vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
           return mix(mix(tblHash(i), tblHash(i + vec2(1.0,0.0)), u.x),
                      mix(tblHash(i + vec2(0.0,1.0)), tblHash(i + vec2(1.0,1.0)), u.x), u.y);
         }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         // Derivative-attenuated fine straight walnut fibers (no wavy high-contrast banding)
         vec2 wp = vWorldPosTable.xz * vec2(1.4, 9.5);
         float fw = length(fwidth(wp));
         float grainFade = 1.0 - smoothstep(0.3, 1.5, fw);
         float fineGrain = (tblNoise(wp) * 0.65 + tblNoise(wp * 2.7) * 0.35 - 0.5) * grainFade;

         vec3 baseWalnut = vec3(0.068, 0.044, 0.031) + vec3(0.018, 0.011, 0.007) * fineGrain;

         // Soft pool of warm studio light around the typewriter
         float distCenter = length(vWorldPosTable.xz * vec2(0.72, 0.92));
         float warmPool = exp(-distCenter * distCenter * 0.032);
         vec3 litWalnut = baseWalnut + vec3(0.055, 0.033, 0.018) * warmPool;

         // Under-chassis soft contact shadow
         vec2 chassisBox = abs(vWorldPosTable.xz - vec2(0.0, 0.7)) / vec2(4.95, 3.65);
         float chassisDist = length(max(chassisBox - 1.0, 0.0));
         float chassisAO = mix(0.28, 1.0, smoothstep(0.0, 0.55, chassisDist));

         // Ambient-occlusion darkening directly under the 4 rubber feet
         float footAO = 1.0;
         footAO *= smoothstep(0.15, 0.85, length(vWorldPosTable.xz - vec2(-4.6, -2.5)));
         footAO *= smoothstep(0.15, 0.85, length(vWorldPosTable.xz - vec2( 4.6, -2.5)));
         footAO *= smoothstep(0.15, 0.85, length(vWorldPosTable.xz - vec2(-4.6,  3.9)));
         footAO *= smoothstep(0.15, 0.85, length(vWorldPosTable.xz - vec2( 4.6,  3.9)));
         footAO = mix(0.15, 1.0, footAO);

         // Smooth dark vignette toward outer edges + film grain
         float edgeVignette = smoothstep(18.5, 4.2, distCenter);
         float filmGrain = (tblHash(vWorldPosTable.xz * 80.0) - 0.5) * 0.008 * grainFade;

         diffuseColor.rgb = litWalnut * chassisAO * footAO * edgeVignette + filmGrain;`
      );
  };

  const tableMesh = new THREE.Mesh(new THREE.PlaneGeometry(54, 54), tableMat);
  tableMesh.rotation.x = -Math.PI / 2;
  tableMesh.position.y = 0.0;
  tableMesh.receiveShadow = true;
  scene.add(tableMesh);

  /**
   * Computes camera distance & target so:
   * - On Desktop (e.g. 1280x800): machine fills ~75% of the viewport width and sits slightly lower
   *   so the hero paper sheet and all 4 key rows are large, commanding, and 100% legible.
   * - On Portrait Mobile (e.g. 390x780): camera tilts higher, fits the full carriage + knobs width
   *   with safe margin so the right knob is never clipped, and uses vertical space for the paper.
   */
  function computeFittedCameraPose() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const isPortrait = aspect < 0.92;

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);

    // Target slightly higher Y so the machine sits lower in the frame and the tall paper sheet is centered
    const target = new THREE.Vector3(
      0.0,
      isPortrait ? 3.25 : 3.42,
      isPortrait ? 0.55 : 0.72
    );

    const viewDir = isPortrait
      ? new THREE.Vector3(0.0, 0.65, 0.76).normalize()
      : new THREE.Vector3(0.035, 0.56, 0.828).normalize();

    if (isPortrait) {
      // Fit full platen + knobs + return lever width (14.4 world units) inside portrait width
      const requiredWidth = 14.8;
      const requiredHeight = 9.4;
      const distW = (requiredWidth * 0.5) / Math.tan(hFovRad * 0.5);
      const distH = (requiredHeight * 0.5) / Math.tan(vFovRad * 0.5);
      const distance = Math.max(distW, distH, 13.5);
      return {
        pos: target.clone().addScaledVector(viewDir, distance),
        lookAt: target
      };
    } else {
      // Desktop: chassis + knobs span ~13.0 units; filling ~75% of viewport width means visible span ~16.8 units
      const requiredWidth = 16.6;
      const requiredHeight = 9.6;
      const distW = (requiredWidth * 0.5) / Math.tan(hFovRad * 0.5);
      const distH = (requiredHeight * 0.5) / Math.tan(vFovRad * 0.5);
      const distance = Math.max(distW, distH, 11.8);
      return {
        pos: target.clone().addScaledVector(viewDir, distance),
        lookAt: target
      };
    }
  }

  function handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    bgUniforms.uResolution.value.set(w, h);
  }

  return {
    renderer,
    scene,
    camera,
    bgScene,
    bgCamera,
    bgUniforms,
    basketLight,
    computeFittedCameraPose,
    handleResize
  };
}
