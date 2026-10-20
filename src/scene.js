import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);

  // 1. Full-Screen Background Shader (Studio Vignette + Film Grain)
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

  // 2. Main 3D Scene, Camera & Physically Plausible RoomEnvironment PMREM
  const scene = new THREE.Scene();
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.045).texture;
  scene.environment = envTexture;

  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 120);

  // 3. Photographic Studio Lighting:
  // - Large warm softbox key light from upper-left (wide soft shadows)
  // - Weak cool fill from right
  // - Subtle warm bounce from the tabletop below
  const hemiBounce = new THREE.HemisphereLight(0xf6eee0, 0x38332e, 0.65);
  hemiBounce.position.set(0, 10, 0);
  scene.add(hemiBounce);

  const softboxKeyLeft = new THREE.DirectionalLight(0xfff1de, 2.15);
  softboxKeyLeft.position.set(-7.8, 10.5, 5.4);
  softboxKeyLeft.castShadow = true;
  softboxKeyLeft.shadow.mapSize.set(2048, 2048);
  softboxKeyLeft.shadow.camera.near = 2.0;
  softboxKeyLeft.shadow.camera.far = 34.0;
  const d = 11.0;
  softboxKeyLeft.shadow.camera.left = -d;
  softboxKeyLeft.shadow.camera.right = d;
  softboxKeyLeft.shadow.camera.top = d;
  softboxKeyLeft.shadow.camera.bottom = -d;
  softboxKeyLeft.shadow.bias = -0.0005;
  softboxKeyLeft.shadow.radius = 4.2; // Wide softbox shadow penumbra
  scene.add(softboxKeyLeft);

  const weakCoolFill = new THREE.DirectionalLight(0x9cb4c9, 0.55);
  weakCoolFill.position.set(8.5, 6.5, -4.5);
  scene.add(weakCoolFill);

  const tableBounce = new THREE.DirectionalLight(0xd9c3a8, 0.42);
  tableBounce.position.set(0.0, -5.0, 6.0);
  scene.add(tableBounce);

  const basketLight = new THREE.PointLight(0xffe6c2, 0.55, 8.0);
  basketLight.position.set(0, 2.8, 0.8);
  scene.add(basketLight);

  // 4. Plain Dark Matte Linen / Aged Wood Desk-Mat with Blurred Dark Elliptical Body AO & Foot Contact Shadows
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.88,
    metalness: 0.02,
    envMapIntensity: 0.15
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
         // Fine matte woven desk-mat / aged timber micro-texture
         vec2 wp = vWorldPosTable.xz * vec2(6.5, 6.5);
         float fw = length(fwidth(wp));
         float grainFade = 1.0 - smoothstep(0.3, 1.4, fw);
         float linenWeave = (tblNoise(wp) * 0.5 + tblNoise(wp * 2.3) * 0.5 - 0.5) * grainFade;

         vec3 baseDesk = vec3(0.082, 0.074, 0.068) + vec3(0.010, 0.009, 0.008) * linenWeave;

         // Subtle softbox light pool from upper-left
         float distLampPool = length((vWorldPosTable.xz - vec2(-1.2, 0.5)) * vec2(0.65, 0.82));
         float warmPool = exp(-distLampPool * distLampPool * 0.032);
         vec3 litDesk = baseDesk + vec3(0.042, 0.036, 0.030) * warmPool;

         // Blurred dark ambient-occlusion ellipse directly under the Lettera 32 body
         vec2 bodyEllipse = (vWorldPosTable.xz - vec2(0.0, 0.65)) / vec2(5.1, 4.1);
         float bodyDistSq = dot(bodyEllipse, bodyEllipse);
         float bodyAO = mix(0.16, 1.0, smoothstep(0.35, 1.35, bodyDistSq));

         // Soft rightward shadow lobe from upper-left softbox
         vec2 rightShadowDelta = (vWorldPosTable.xz - vec2(3.8, -0.6)) * vec2(0.20, 0.30);
         float rightShadow = exp(-dot(rightShadowDelta, rightShadowDelta));
         float castLobeAO = 1.0 - rightShadow * 0.35;

         // Contact AO under the 4 rubber feet
         float footAO = 1.0;
         footAO *= smoothstep(0.12, 0.78, length(vWorldPosTable.xz - vec2(-4.4, -2.3)));
         footAO *= smoothstep(0.12, 0.78, length(vWorldPosTable.xz - vec2( 4.4, -2.3)));
         footAO *= smoothstep(0.12, 0.78, length(vWorldPosTable.xz - vec2(-4.4,  3.7)));
         footAO *= smoothstep(0.12, 0.78, length(vWorldPosTable.xz - vec2( 4.4,  3.7)));
         footAO = mix(0.12, 1.0, footAO);

         // Mild depth-of-field-style outer vignette + subtle film grain
         float distCenter = length(vWorldPosTable.xz * vec2(0.70, 0.88));
         float edgeVignette = smoothstep(18.5, 4.0, distCenter);
         float filmGrain = (tblHash(vWorldPosTable.xz * 75.0) - 0.5) * 0.007 * grainFade;

         diffuseColor.rgb = litDesk * bodyAO * castLobeAO * footAO * edgeVignette + filmGrain;`
      );
  };

  const tableMesh = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), tableMat);
  tableMesh.rotation.x = -Math.PI / 2;
  tableMesh.position.y = 0.0;
  tableMesh.receiveShadow = true;
  scene.add(tableMesh);

  const bboxCorners = Array.from({ length: 8 }, () => new THREE.Vector3());
  const rightAxis = new THREE.Vector3();
  const upAxis = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const relVec = new THREE.Vector3();

  /**
   * Responsive Camera Composition:
   * - Portrait phones (aspect < 0.92): Lower, closer 3/4 camera aimed near the printing point,
   *   fitting both ribbed platen knobs at ~96% of the viewport width so the sheet above and
   *   staggered keys below fill the portrait screen.
   * - Desktop / Landscape phones: Fits the full Lettera 32 + curled paper top + spacebar
   *   with ~6% margin on all four sides.
   */
  function computeFittedCameraPose() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const isPortrait = aspect < 0.92;

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const tanHalfVFov = Math.tan(vFovRad * 0.5);
    const tanHalfHFov = tanHalfVFov * aspect;

    if (isPortrait) {
      // Closer, lower 3/4 camera aimed at the printing point & upper deck
      const viewDir = new THREE.Vector3(0.0, 0.53, 0.848).normalize();
      rightAxis.crossVectors(worldUp, viewDir).normalize();
      upAxis.crossVectors(viewDir, rightAxis).normalize();

      // Platen + both ribbed knobs span [-6.25, +6.25] = 12.50 world units.
      // Fitting 12.50 units to ~96% of the screen width (marginScale = 1.0 / 0.96 = 1.042):
      const halfSpanX = 6.28;
      const zFront = 1.4;
      const distance = (halfSpanX * 1.042) / tanHalfHFov + zFront;

      // Aim right at the Lettera 32 printing point / upper cover so paper rises above and keys fill below
      const lookAt = new THREE.Vector3(0.0, 2.38, 1.05);
      const pos = lookAt.clone().addScaledVector(viewDir, distance);
      return { pos, lookAt };
    }

    // Desktop & Landscape Phone: 8-corner exact view-space bounding-box fit with ~6% margin
    const viewDir = new THREE.Vector3(0.025, 0.54, 0.841).normalize();
    rightAxis.crossVectors(worldUp, viewDir).normalize();
    upAxis.crossVectors(viewDir, rightAxis).normalize();

    const minX = -6.75;
    const maxX =  6.65;
    const minY =  0.0;
    const maxY = CONFIG.machineBoundsMax.y; // 5.95
    const minZ = -2.65;
    const maxZ =  5.05;

    const center = new THREE.Vector3(
      (minX + maxX) * 0.5,
      (minY + maxY) * 0.5,
      (minZ + maxZ) * 0.5
    );

    let cIdx = 0;
    for (let ix = 0; ix < 2; ix++) {
      for (let iy = 0; iy < 2; iy++) {
        for (let iz = 0; iz < 2; iz++) {
          bboxCorners[cIdx++].set(
            ix ? maxX : minX,
            iy ? maxY : minY,
            iz ? maxZ : minZ
          );
        }
      }
    }

    const marginScale = 1.135; // ~6% margin on all sides
    let distance = 13.5;
    let shiftRight = 0;
    let shiftUp = 0;

    for (let iter = 0; iter < 3; iter++) {
      let reqDist = 8.0;
      let minProjX = Infinity, maxProjX = -Infinity;
      let minProjY = Infinity, maxProjY = -Infinity;

      for (let i = 0; i < 8; i++) {
        relVec.copy(bboxCorners[i]).sub(center);
        const xCam = relVec.dot(rightAxis) - shiftRight;
        const yCam = relVec.dot(upAxis) - shiftUp;
        const zCam = relVec.dot(viewDir);

        minProjX = Math.min(minProjX, xCam);
        maxProjX = Math.max(maxProjX, xCam);
        minProjY = Math.min(minProjY, yCam);
        maxProjY = Math.max(maxProjY, yCam);

        const dX = (Math.abs(xCam) * marginScale) / tanHalfHFov + zCam;
        const dY = (Math.abs(yCam) * marginScale) / tanHalfVFov + zCam;
        reqDist = Math.max(reqDist, dX, dY);
      }

      shiftRight += (minProjX + maxProjX) * 0.5;
      shiftUp    += (minProjY + maxProjY) * 0.5;
      distance = reqDist;
    }

    const lookAt = center.clone()
      .addScaledVector(rightAxis, shiftRight)
      .addScaledVector(upAxis, shiftUp);

    const pos = lookAt.clone().addScaledVector(viewDir, distance);
    return { pos, lookAt };
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
