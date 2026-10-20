import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG } from './config.js';
import { BACKGROUND_VERTEX_SHADER, BACKGROUND_FRAGMENT_SHADER } from './shaders/background.js';

function createBakedContactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 512, 512);

  ctx.save();
  ctx.translate(256, 268);
  ctx.scale(1.18, 0.96);
  const bodyGrad = ctx.createRadialGradient(0, 0, 24, 0, 0, 205);
  bodyGrad.addColorStop(0.0, 'rgba(8, 6, 5, 0.82)');
  bodyGrad.addColorStop(0.55, 'rgba(10, 8, 6, 0.54)');
  bodyGrad.addColorStop(0.82, 'rgba(12, 10, 8, 0.16)');
  bodyGrad.addColorStop(1.0, 'rgba(12, 10, 8, 0.0)');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 205, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const feetCoords = [
    [118, 152],
    [394, 152],
    [118, 365],
    [394, 365]
  ];
  feetCoords.forEach(([fx, fy]) => {
    const fGrad = ctx.createRadialGradient(fx, fy, 2, fx, fy, 36);
    fGrad.addColorStop(0.0, 'rgba(3, 2, 2, 0.90)');
    fGrad.addColorStop(0.5, 'rgba(6, 5, 4, 0.42)');
    fGrad.addColorStop(1.0, 'rgba(6, 5, 4, 0.0)');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, 36, 0, Math.PI * 2);
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
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);

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

  const scene = new THREE.Scene();
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const roomEnv = new RoomEnvironment();
  const envTexture = pmremGenerator.fromScene(roomEnv, 0.035).texture;
  roomEnv.dispose();
  scene.environment = envTexture;

  const camera = new THREE.PerspectiveCamera(29, window.innerWidth / window.innerHeight, 0.1, 160);

  const hemiBounce = new THREE.HemisphereLight(0xf2e8d8, 0x362d26, 0.62);
  hemiBounce.position.set(0, 10, 0);
  scene.add(hemiBounce);

  const softboxSpot = new THREE.SpotLight(0xfff0dd, 2.38);
  softboxSpot.position.set(-8.5, 11.5, 6.2);
  softboxSpot.target.position.set(0, 1.5, 0.5);
  softboxSpot.angle = Math.PI * 0.44;
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

  const weakCoolFill = new THREE.DirectionalLight(0x90a8bd, 0.46);
  weakCoolFill.position.set(8.5, 6.0, -4.0);
  scene.add(weakCoolFill);

  const tableBounce = new THREE.DirectionalLight(0xd4bc9e, 0.40);
  tableBounce.position.set(0.0, -5.0, 5.5);
  scene.add(tableBounce);

  const basketLight = new THREE.PointLight(0xffe4be, 0.38, 7.5);
  basketLight.position.set(0, 2.7, 0.7);
  scene.add(basketLight);

  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x261e18,
    roughness: 0.92,
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
         vec2 wp = vWorldPosTable.xz * vec2(2.2, 7.5);
         float fw = length(fwidth(wp));
         float grainFade = 1.0 - smoothstep(0.3, 1.4, fw);
         float woodFiber = (tblNoise(wp) * 0.6 + tblNoise(wp * 2.4) * 0.4 - 0.5) * grainFade;
         float crossWeave = (tblNoise(vWorldPosTable.xz * 5.0) - 0.5) * 0.4 * grainFade;

         vec3 baseDesk = vec3(0.125, 0.098, 0.076) + vec3(0.018, 0.013, 0.009) * (woodFiber + crossWeave);

         float distPool = length((vWorldPosTable.xz - vec2(-0.5, 2.2)) * vec2(0.42, 0.36));
         float warmPool = exp(-distPool * distPool * 0.022);
         vec3 litDesk = baseDesk + vec3(0.068, 0.050, 0.034) * warmPool;

         vec2 rightShadowDelta = (vWorldPosTable.xz - vec2(3.8, -0.5)) * vec2(0.18, 0.28);
         float rightShadow = exp(-dot(rightShadowDelta, rightShadowDelta));
         float castLobeAO = 1.0 - rightShadow * 0.28;

         float radialDist = length((vWorldPosTable.xz - vec2(0.0, 2.0)) * vec2(0.45, 0.38));
         float outerFade = smoothstep(28.0, 6.0, radialDist);
         vec3 bgEdgeTone = vec3(0.045, 0.038, 0.033);

         diffuseColor.rgb = mix(bgEdgeTone, litDesk * castLobeAO, outerFade);`
      );
  };

  const tableMesh = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), tableMat);
  tableMesh.rotation.x = -Math.PI / 2;
  tableMesh.position.y = 0.0;
  tableMesh.receiveShadow = true;
  scene.add(tableMesh);

  const aoPlaneMat = new THREE.MeshBasicMaterial({
    map: createBakedContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.88
  });
  const aoPlane = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 11.6), aoPlaneMat);
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
   * - Portrait phones (aspect < 0.92):
   *   Explicitly fits the actual platen + knobs half-width (5.78 units at Z = -1.16) so that the
   *   visible machine spans ~96% of the screen width (`halfWidth / 0.96`), centered horizontally
   *   and vertically!
   * - Desktop & Landscape phones:
   *   8-corner view-space bounding-box fit with ~6% margin.
   */
  function computeFittedCameraPose() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const isPortrait = aspect < 0.92;

    const targetFov = isPortrait ? 25 : 29;
    if (camera.fov !== targetFov) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const tanHalfVFov = Math.tan(vFovRad * 0.5);
    const tanHalfHFov = tanHalfVFov * aspect;

    if (isPortrait) {
      const viewDir = new THREE.Vector3(0.0, 0.49, 0.872).normalize();
      rightAxis.crossVectors(worldUp, viewDir).normalize();
      upAxis.crossVectors(viewDir, rightAxis).normalize();

      // Center of the machine + sheet composition
      const lookAt = new THREE.Vector3(0.0, 2.32, 0.85);

      // The widest part of the machine (platen + both ribbed knobs) sits at Y = 2.84, Z = -1.16
      // with half-width = 5.78 world units; the front chassis cheeks at Z = 2.0 have half-width = 5.12.
      // Project both planes to guarantee the machine fills ~96% of the portrait screen width!
      const platenRel = new THREE.Vector3(0, 2.84, -1.16).sub(lookAt);
      const platenZCam = platenRel.dot(viewDir);
      const distForPlaten96 = (5.78 / 0.96) / tanHalfHFov + platenZCam;

      const cheekRel = new THREE.Vector3(0, 1.2, 2.5).sub(lookAt);
      const cheekZCam = cheekRel.dot(viewDir);
      const distForCheeks96 = (5.12 / 0.96) / tanHalfHFov + cheekZCam;

      const distance = Math.max(distForPlaten96, distForCheeks96);

      // Vertically center the top of the sheet (0, 5.75, -1.65) and front base edge (0, 0.0, 4.85)
      const topRel = new THREE.Vector3(0, 5.75, -1.65).sub(lookAt);
      const botRel = new THREE.Vector3(0, 0.0, 4.85).sub(lookAt);
      const topNdcY = topRel.dot(upAxis) / ((distance - topRel.dot(viewDir)) * tanHalfVFov);
      const botNdcY = botRel.dot(upAxis) / ((distance - botRel.dot(viewDir)) * tanHalfVFov);
      const shiftUp = ((topNdcY + botNdcY) * 0.5) * distance * tanHalfVFov * 0.92;

      lookAt.addScaledVector(upAxis, shiftUp);
      const pos = lookAt.clone().addScaledVector(viewDir, distance);
      return { pos, lookAt };
    }

    // Desktop & Landscape Phone
    const viewDir = new THREE.Vector3(0.02, 0.54, 0.841).normalize();
    rightAxis.crossVectors(worldUp, viewDir).normalize();
    upAxis.crossVectors(viewDir, rightAxis).normalize();

    const minX = -6.65;
    const maxX =  6.85;
    const minY =  0.0;
    const maxY = CONFIG.machineBoundsMax.y;
    const minZ = -2.65;
    const maxZ =  4.95;

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

    for (let iter = 0; iter < 4; iter++) {
      let reqDist = 8.0;
      let minProjX = Infinity, maxProjX = -Infinity;
      let minProjY = Infinity, maxProjY = -Infinity;

      for (let i = 0; i < 8; i++) {
        relVec.copy(bboxCorners[i]).sub(center);
        const xCam = relVec.dot(rightAxis) - shiftRight;
        const yCam = relVec.dot(upAxis) - shiftUp;
        const zCam = relVec.dot(viewDir);

        const effDist = Math.max(2.0, distance - zCam);
        const ndcX = xCam / (effDist * tanHalfHFov);
        const ndcY = yCam / (effDist * tanHalfVFov);

        minProjX = Math.min(minProjX, ndcX);
        maxProjX = Math.max(maxProjX, ndcX);
        minProjY = Math.min(minProjY, ndcY);
        maxProjY = Math.max(maxProjY, ndcY);

        const dX = (Math.abs(xCam) * marginScale) / tanHalfHFov + zCam;
        const dY = (Math.abs(yCam) * marginScale) / tanHalfVFov + zCam;
        reqDist = Math.max(reqDist, dX, dY);
      }

      shiftRight += ((minProjX + maxProjX) * 0.5) * distance * tanHalfHFov * 0.85;
      shiftUp    += ((minProjY + maxProjY) * 0.5) * distance * tanHalfVFov * 0.85;
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
