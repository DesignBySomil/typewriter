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
  renderer.toneMappingExposure = 1.24;
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
  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 120);

  // 3. Rich Studio Lighting (Lifted hemisphere + warm key + cool rim + soft front fill so nothing crushes to black)
  const hemiLight = new THREE.HemisphereLight(0xfff0d8, 0x384952, 1.15);
  hemiLight.position.set(0, 12, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffe2be, 2.75);
  keyLight.position.set(6.0, 11.5, 8.0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 2.0;
  keyLight.shadow.camera.far = 30.0;
  const d = 8.5;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.radius = 2.5;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x88d0ec, 1.55);
  rimLight.position.set(-8.0, 7.0, -7.0);
  scene.add(rimLight);

  // Soft front fill light so front enamel chin, key stems, and typebasket are always clearly readable
  const frontFill = new THREE.DirectionalLight(0xffeedd, 1.05);
  frontFill.position.set(0.0, 5.0, 11.0);
  scene.add(frontFill);

  // Breathing warm point light inside the typebasket
  const basketLight = new THREE.PointLight(0xffb86c, 1.15, 9.0);
  basketLight.position.set(0, 3.1, 1.1);
  scene.add(basketLight);

  // 4. Procedural Wood-Grain Tabletop Plane
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x2a1b12,
    roughness: 0.62,
    metalness: 0.05
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
         vec2 wp = vWorldPosTable.xz * vec2(0.55, 2.8);
         float n = tblNoise(wp) * 0.6 + tblNoise(wp * 2.4) * 0.3 + tblNoise(wp * 6.0) * 0.1;
         float grain = sin(vWorldPosTable.z * 8.5 + n * 5.2) * 0.5 + 0.5;
         vec3 darkWalnut = vec3(0.095, 0.058, 0.038);
         vec3 warmWalnut = vec3(0.20, 0.122, 0.078);
         float deskVignette = smoothstep(20.0, 3.0, length(vWorldPosTable.xz));
         diffuseColor.rgb = mix(darkWalnut, warmWalnut, grain * 0.7 + n * 0.3) * deskVignette;`
      );
  };

  const tableMesh = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), tableMat);
  tableMesh.rotation.x = -Math.PI / 2;
  tableMesh.position.y = 0.0;
  tableMesh.receiveShadow = true;
  scene.add(tableMesh);

  /**
   * Computes exact camera distance & lookAt from the full machine bounding box
   * and current viewport aspect ratio so paper top, platen, knobs, basket,
   * all 4 key rows, spacebar, and front edge fit with comfortable margin.
   */
  function computeFittedCameraPose() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const bMin = CONFIG.machineBoundsMin;
    const bMax = CONFIG.machineBoundsMax;

    const boxWidth  = (bMax.x - bMin.x); // ~13.5 units
    const boxHeight = (bMax.y - bMin.y); // ~6.85 units
    const boxDepth  = (bMax.z - bMin.z); // ~8.8 units

    // Center of visual interest (frames paper top down to spacebar bottom)
    const isPortrait = aspect < 0.92;
    const target = new THREE.Vector3(
      0.0,
      isPortrait ? 3.15 : 3.05,
      isPortrait ? 0.65 : 0.75
    );

    // Three-quarter high viewing direction (normalized)
    const viewDir = isPortrait
      ? new THREE.Vector3(0.03, 0.64, 0.768).normalize()
      : new THREE.Vector3(0.07, 0.61, 0.789).normalize();

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);

    // Apparent projected height and width at the three-quarter pitch angle
    const effectiveHeight = boxHeight * 0.88 + boxDepth * 0.56;
    const effectiveWidth  = boxWidth * 1.04;

    // Margin multiplier ensures HUD corner cards never touch keys or platen knobs
    const marginFactor = isPortrait ? 1.18 : 1.24;

    const distForHeight = (effectiveHeight * 0.5 * marginFactor) / Math.tan(vFovRad * 0.5);
    const distForWidth  = (effectiveWidth  * 0.5 * marginFactor) / Math.tan(hFovRad * 0.5);
    const distance = Math.max(distForHeight, distForWidth, 14.2);

    const pos = target.clone().addScaledVector(viewDir, distance);
    return { pos, lookAt: target };
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
