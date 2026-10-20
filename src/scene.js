import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG } from './config.js';
import { BACKGROUND_VERTEX_SHADER, BACKGROUND_FRAGMENT_SHADER } from './shaders/background.js';

/**
 * Generates a soft baked Ambient Occlusion contact-shadow CanvasTexture
 * placed directly beneath the typewriter chassis and rubber feet.
 */
function createBakedContactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 512, 512);

  // Soft elliptical body ambient occlusion shadow
  ctx.save();
  ctx.translate(256, 268);
  ctx.scale(1.18, 0.96);
  const bodyGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, 195);
  bodyGrad.addColorStop(0.0, 'rgba(5, 4, 4, 0.88)');
  bodyGrad.addColorStop(0.55, 'rgba(6, 5, 4, 0.62)');
  bodyGrad.addColorStop(0.82, 'rgba(8, 7, 6, 0.18)');
  bodyGrad.addColorStop(1.0, 'rgba(8, 7, 6, 0.0)');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 195, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Four darker contact AO spots under the four rubber feet
  const feetCoords = [
    [118, 152],
    [394, 152],
    [118, 365],
    [394, 365]
  ];
  feetCoords.forEach(([fx, fy]) => {
    const fGrad = ctx.createRadialGradient(fx, fy, 2, fx, fy, 34);
    fGrad.addColorStop(0.0, 'rgba(2, 2, 2, 0.92)');
    fGrad.addColorStop(0.5, 'rgba(4, 3, 3, 0.45)');
    fGrad.addColorStop(1.0, 'rgba(4, 3, 3, 0.0)');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, 34, 0, Math.PI * 2);
    ctx.fill();
  });

  return new THREE.CanvasTexture(canvas);
}

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
  renderer.toneMappingExposure = 0.90;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);

  // 1. Full-Screen Seamless Background Shader
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

  // 2. Main 3D Scene, Camera & Low-Intensity RoomEnvironment PMREM (sigma = 0.035 <= 0.04)
  const scene = new THREE.Scene();
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const roomEnv = new RoomEnvironment();
  const envTexture = pmremGenerator.fromScene(roomEnv, 0.035).texture;
  roomEnv.dispose();
  scene.environment = envTexture;

  const camera = new THREE.PerspectiveCamera(29, window.innerWidth / window.innerHeight, 0.1, 160);

  // 3. Photographic Studio Lighting
  const hemiBounce = new THREE.HemisphereLight(0xefe6d8, 0x2a2623, 0.55);
  hemiBounce.position.set(0, 10, 0);
  scene.add(hemiBounce);

  const softboxSpot = new THREE.SpotLight(0xfff0dd, 2.35);
  softboxSpot.position.set(-8.5, 11.5, 6.2);
  softboxSpot.target.position.set(0, 1.5, 0.5);
  softboxSpot.angle = Math.PI * 0.42;
  softboxSpot.penumbra = 0.95;
  softboxSpot.decay = 0.0;
  softboxSpot.distance = 45.0;
  softboxSpot.castShadow = true;
  softboxSpot.shadow.mapSize.set(2048, 2048);
  softboxSpot.shadow.camera.near = 3.0;
  softboxSpot.shadow.camera.far = 32.0;
  softboxSpot.shadow.bias = -0.0004;
  softboxSpot.shadow.radius = 5.0;
  scene.add(softboxSpot);
  scene.add(softboxSpot.target);

  const weakCoolFill = new THREE.DirectionalLight(0x90a8bd, 0.45);
  weakCoolFill.position.set(8.5, 6.0, -4.0);
  scene.add(weakCoolFill);

  const tableBounce = new THREE.DirectionalLight(0xcab69c, 0.35);
  tableBounce.position.set(0.0, -5.0, 5.5);
  scene.add(tableBounce);

  const basketLight = new THREE.PointLight(0xffe4be, 0.38, 7.5);
  basketLight.position.set(0, 2.7, 0.7);
  scene.add(basketLight);

  // 4. Seamless Dark Matte Desk-Mat Plane
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x161412,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.08
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
         vec2 wp = vWorldPosTable.xz * vec2(5.5, 5.5);
         float fw = length(fwidth(wp));
         float grainFade = 1.0 - smoothstep(0.3, 1.4, fw);
         float linenWeave = (tblNoise(wp) * 0.5 + tblNoise(wp * 2.3) * 0.5 - 0.5) * grainFade;

         vec3 baseDesk = vec3(0.078, 0.070, 0.064) + vec3(0.008, 0.007, 0.006) * linenWeave;

         float distPool = length((vWorldPosTable.xz - vec2(-0.8, 0.5)) * vec2(0.55, 0.65));
         float warmPool = exp(-distPool * distPool * 0.025);
         vec3 litDesk = baseDesk + vec3(0.032, 0.028, 0.023) * warmPool;

         vec2 rightShadowDelta = (vWorldPosTable.xz - vec2(3.8, -0.5)) * vec2(0.18, 0.28);
         float rightShadow = exp(-dot(rightShadowDelta, rightShadowDelta));
         float castLobeAO = 1.0 - rightShadow * 0.34;

         float radialDist = length(vWorldPosTable.xz * vec2(0.55, 0.55));
         float outerFade = smoothstep(26.0, 4.5, radialDist);
         vec3 bgEdgeTone = vec3(0.028, 0.025, 0.022);

         diffuseColor.rgb = mix(bgEdgeTone, litDesk * castLobeAO, outerFade);`
      );
  };

  const tableMesh = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), tableMat);
  tableMesh.rotation.x = -Math.PI / 2;
  tableMesh.position.y = 0.0;
  tableMesh.receiveShadow = true;
  scene.add(tableMesh);

  // Baked Blurred Contact-Shadow / AO Plane directly under the body & rubber feet
  const aoPlaneMat = new THREE.MeshBasicMaterial({
    map: createBakedContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.92
  });
  const aoPlane = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 11.4), aoPlaneMat);
  aoPlane.rotation.x = -Math.PI / 2;
  aoPlane.position.set(0, 0.005, 0.72);
  scene.add(aoPlane);

  const bboxCorners = Array.from({ length: 8 }, () => new THREE.Vector3());
  const rightAxis = new THREE.Vector3();
  const upAxis = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const relVec = new THREE.Vector3();

  /**
   * Responsive Camera Composition:
   * - Portrait phones (390x780, 430x932; aspect < 0.92):
   *   Uses a narrower 24° vertical FOV and horizontal aspect fit on the machine's physical width
   *   (including both ribbed knobs at ±5.80 world units) so the machine fills ~96% of the screen width!
   *   Moves the camera closer and lower at a 3/4 angle aimed near the printing point, shifting the
   *   composition so the machine sits slightly below centre with the full paper sheet rising above.
   * - Desktop (1280x800) & Landscape phones (844x390):
   *   Unchanged 8-corner bounding-box fit with ~6% margin on all sides.
   */
  function computeFittedCameraPose() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const isPortrait = aspect < 0.92;

    const targetFov = isPortrait ? 24 : 29;
    if (camera.fov !== targetFov) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const tanHalfVFov = Math.tan(vFovRad * 0.5);
    const tanHalfHFov = tanHalfVFov * aspect;

    if (isPortrait) {
      // Closer, lower 3/4 angle looking at the printing point & upper keyboard deck
      const viewDir = new THREE.Vector3(0.0, 0.47, 0.882).normalize();
      rightAxis.crossVectors(worldUp, viewDir).normalize();
      upAxis.crossVectors(viewDir, rightAxis).normalize();

      // Machine body + platen + both ribbed knobs span [-5.80, +5.80] = 11.60 world units.
      // To make 11.60 world units fill ~96% of the viewport width (margin factor 1 / 0.96 = 1.0417):
      const halfWidthAtPlaten = 5.80;
      const platenZOffset = -1.65; // Platen is slightly behind lookAt along viewDir
      const distForWidth96 = (halfWidthAtPlaten * 1.042) / tanHalfHFov + platenZOffset;

      // Also verify vertical fit so neither paper top nor spacebar clips on shorter portrait ratios
      const halfHeightSpan = 3.25;
      const distForHeight = (halfHeightSpan * 1.06) / tanHalfVFov;
      const distance = Math.max(distForWidth96, distForHeight);

      // Shift lookAt slightly higher (Y = 2.46) so the machine sits slightly below center with the sheet above
      const lookAt = new THREE.Vector3(0.0, 2.46, 0.95);
      const pos = lookAt.clone().addScaledVector(viewDir, distance);
      return { pos, lookAt };
    }

    // Desktop & Landscape Phone (Unchanged 8-corner view-space bounding-box fit)
    const viewDir = new THREE.Vector3(0.02, 0.54, 0.841).normalize();
    rightAxis.crossVectors(worldUp, viewDir).normalize();
    upAxis.crossVectors(viewDir, rightAxis).normalize();

    const minX = -6.65;
    const maxX =  6.85;
    const minY =  0.0;
    const maxY = CONFIG.machineBoundsMax.y; // 5.82
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

    const marginScale = 1.135;
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
