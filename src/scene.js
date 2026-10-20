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
  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 120);

  // 3. Studio Lighting:
  // - Lifted hemisphere fill
  // - Warm desk lamp from UPPER-LEFT casting a soft long shadow of the machine on the table to the RIGHT
  // - Cool rim light + soft front fill
  const hemiLight = new THREE.HemisphereLight(0xfff2dc, 0x3b4d56, 1.15);
  hemiLight.position.set(0, 12, 0);
  scene.add(hemiLight);

  const warmLampLeft = new THREE.DirectionalLight(0xffdca8, 2.75);
  warmLampLeft.position.set(-8.5, 10.2, 4.8);
  warmLampLeft.castShadow = true;
  warmLampLeft.shadow.mapSize.set(2048, 2048);
  warmLampLeft.shadow.camera.near = 2.0;
  warmLampLeft.shadow.camera.far = 36.0;
  const d = 11.5;
  warmLampLeft.shadow.camera.left = -d;
  warmLampLeft.shadow.camera.right = d;
  warmLampLeft.shadow.camera.top = d;
  warmLampLeft.shadow.camera.bottom = -d;
  warmLampLeft.shadow.bias = -0.0005;
  warmLampLeft.shadow.radius = 3.6;
  scene.add(warmLampLeft);

  const coolRimRight = new THREE.DirectionalLight(0x88d0ec, 1.35);
  coolRimRight.position.set(8.0, 7.5, -6.5);
  scene.add(coolRimRight);

  const frontFill = new THREE.DirectionalLight(0xfff0df, 1.12);
  frontFill.position.set(2.0, 6.5, 11.5);
  scene.add(frontFill);

  const basketLight = new THREE.PointLight(0xffb86c, 1.25, 9.5);
  basketLight.position.set(0, 3.1, 1.1);
  scene.add(basketLight);

  // 4. Dark, Low-Contrast, Fine-Grained Walnut Tabletop with Warm Left Lamp Pool & Rightward Soft Shadow
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
         vec2 wp = vWorldPosTable.xz * vec2(1.4, 9.5);
         float fw = length(fwidth(wp));
         float grainFade = 1.0 - smoothstep(0.3, 1.5, fw);
         float fineGrain = (tblNoise(wp) * 0.65 + tblNoise(wp * 2.7) * 0.35 - 0.5) * grainFade;

         vec3 baseWalnut = vec3(0.068, 0.044, 0.031) + vec3(0.016, 0.010, 0.006) * fineGrain;

         // Warm pool biased slightly upper-left toward the desk lamp
         float distLampPool = length((vWorldPosTable.xz - vec2(-1.4, 0.4)) * vec2(0.68, 0.88));
         float warmPool = exp(-distLampPool * distLampPool * 0.035);
         vec3 litWalnut = baseWalnut + vec3(0.062, 0.038, 0.020) * warmPool;

         // Under-chassis soft contact shadow + long rightward cast shadow lobe from upper-left lamp
         vec2 chassisBox = abs(vWorldPosTable.xz - vec2(0.0, 0.7)) / vec2(4.95, 3.65);
         float chassisDist = length(max(chassisBox - 1.0, 0.0));
         float chassisAO = mix(0.24, 1.0, smoothstep(0.0, 0.60, chassisDist));

         vec2 rightShadowDelta = vWorldPosTable.xz - vec2(4.2, -0.8);
         float rightShadow = exp(-dot(rightShadowDelta * vec2(0.22, 0.34), rightShadowDelta * vec2(0.22, 0.34)));
         float longCastAO = 1.0 - rightShadow * 0.42;

         // Ambient-occlusion darkening directly under the 4 rubber feet
         float footAO = 1.0;
         footAO *= smoothstep(0.15, 0.85, length(vWorldPosTable.xz - vec2(-4.6, -2.5)));
         footAO *= smoothstep(0.15, 0.85, length(vWorldPosTable.xz - vec2( 4.6, -2.5)));
         footAO *= smoothstep(0.15, 0.85, length(vWorldPosTable.xz - vec2(-4.6,  3.9)));
         footAO *= smoothstep(0.15, 0.85, length(vWorldPosTable.xz - vec2( 4.6,  3.9)));
         footAO = mix(0.14, 1.0, footAO);

         float distCenter = length(vWorldPosTable.xz * vec2(0.72, 0.92));
         float edgeVignette = smoothstep(19.0, 4.2, distCenter);
         float filmGrain = (tblHash(vWorldPosTable.xz * 80.0) - 0.5) * 0.008 * grainFade;

         diffuseColor.rgb = litWalnut * chassisAO * longCastAO * footAO * edgeVignette + filmGrain;`
      );
  };

  const tableMesh = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), tableMat);
  tableMesh.rotation.x = -Math.PI / 2;
  tableMesh.position.y = 0.0;
  tableMesh.receiveShadow = true;
  scene.add(tableMesh);

  // Pre-allocated vectors for exact 8-corner view-space bounding box camera fitting
  const bboxCorners = Array.from({ length: 8 }, () => new THREE.Vector3());
  const rightAxis = new THREE.Vector3();
  const upAxis = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const relVec = new THREE.Vector3();

  /**
   * Projects all 8 corners of the machine's 3D bounding box (including the curled paper top,
   * spacebar front edge, and platen knobs) along the camera view basis to compute the exact
   * lookAt target and camera distance so the machine fills the frame with ~6% margin on every side.
   */
  function computeFittedCameraPose() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const isPortrait = aspect < 0.92;

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const tanHalfVFov = Math.tan(vFovRad * 0.5);
    const tanHalfHFov = tanHalfVFov * aspect;

    // Viewing angle: raised slightly on portrait so keys + sheet both fill the screen cleanly
    const viewDir = isPortrait
      ? new THREE.Vector3(0.0, 0.67, 0.742).normalize()
      : new THREE.Vector3(0.025, 0.55, 0.834).normalize();

    rightAxis.crossVectors(worldUp, viewDir).normalize();
    upAxis.crossVectors(viewDir, rightAxis).normalize();

    // Bounding box of the visible machine + curled paper sheet + spacebar + platen knobs
    // On desktop, X spans [-7.1, +7.1]; on portrait, X spans [-7.55, +7.35] so neither platen knob is ever cut
    const minX = isPortrait ? -7.55 : -7.10;
    const maxX = isPortrait ?  7.35 :  7.10;
    const minY = 0.0;
    const maxY = CONFIG.machineBoundsMax.y; // 6.42 (top of the 55% curled sheet)
    const minZ = -2.75;
    const maxZ =  5.25; // Front edge of spacebar

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

    // 6% margin on all 4 sides -> usable half-extent is 0.88 of half-screen (1.0 / 0.88 = 1.136)
    const marginScale = isPortrait ? 1.12 : 1.135;

    // Two-pass exact perspective frustum fit (accounts for depth foreshortening zCam of each corner)
    let distance = 14.0;
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

    // Shift portrait target slightly downward in screen Y so the bottom telemetry bar never touches the spacebar
    if (isPortrait) {
      shiftUp -= 0.18;
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
