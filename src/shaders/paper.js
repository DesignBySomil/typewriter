export const PAPER_VERTEX_SHADER = /* glsl */`
  uniform float uTime;
  uniform float uFeedWave;
  uniform float uInsertProgress;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vArchFactor;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // uv.y = 0 at the bottom wrapped under the platen; uv.y = 1 at the top edge of the sheet
    float heightRatio = clamp(uv.y, 0.0, 1.0);
    vArchFactor = heightRatio;

    // Subtle mechanical flutter when line-feeding or inserting a new sheet
    float flutter = sin(uv.y * 14.0 - uTime * 22.0) * uFeedWave * 0.038 * heightRatio;

    // Soft top-edge curl where the sheet leaves the platen and rises up
    float topCurl = smoothstep(0.55, 1.0, heightRatio) * pow(max(0.0, heightRatio - 0.55) / 0.45, 1.8) * 0.22;
    float cornerCurl = pow(abs(uv.x - 0.5) * 2.0, 2.5) * smoothstep(0.7, 1.0, heightRatio) * 0.08;

    // Sheet insertion slide animation (slides up out of the platen on load / new sheet)
    float slideOffset = (1.0 - uInsertProgress) * 2.4;
    pos.y -= slideOffset * heightRatio;
    pos.z += flutter - topCurl + cornerCurl;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const PAPER_FRAGMENT_SHADER = /* glsl */`
  uniform sampler2D uTextMap;
  uniform float uTime;
  uniform float uScrollV;
  uniform vec3 uLightDir;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vArchFactor;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
      mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x),
      u.y
    );
  }

  void main() {
    // Hero Paper Mapping:
    // vUv.y = 0.30 sits clearly above the platen & paper bail bar in full camera view!
    // At vUv.y = 0.30, we map to the active typing baseline on the 2048px canvas:
    // paperActiveLineCanvasY = 1850 -> from top = 1850 / 2048 = 0.9033 -> Texture V (flipY=true) = 1.0 - 0.9033 = 0.0967.
    // Scale factor 0.62 maps the visible upper sheet (vUv.y: 0.30 -> 1.0) across ~12 previous lines (each 74px = 0.0361 V),
    // making every single character large, crisp, and effortlessly legible at 1280x800!
    float vFromPrintPoint = vUv.y - 0.30;
    float texV = 0.0967 + vFromPrintPoint * 0.62 + uScrollV;
    vec2 texUv = vec2(vUv.x, texV);

    // Multi-octave warm cotton paper fiber noise (filtered by derivative to stay silky smooth)
    vec2 fiberCoord = vUv * vec2(140.0, 175.0);
    float fw = length(fwidth(fiberCoord));
    float fiberFade = 1.0 - smoothstep(0.35, 1.2, fw);
    float f1 = noise(fiberCoord);
    float f2 = noise(vUv * vec2(310.0, 85.0));
    float fiber = ((f1 * 0.65 + f2 * 0.35) - 0.5) * fiberFade;

    // Sample RGBA CanvasTexture:
    // R = Black ink density, G = Red bichrome ink density, B = letterpress deboss heightfield
    vec2 texel = vec2(1.15 / 2048.0);
    vec4 cC = vec4(0.0);
    float hL = 0.0;
    float hR = 0.0;
    float hD = 0.0;
    float hU = 0.0;

    if (texUv.y >= 0.01 && texUv.y <= 0.99 && texUv.x >= 0.01 && texUv.x <= 0.99) {
      cC = texture2D(uTextMap, texUv);
      hL = texture2D(uTextMap, texUv - vec2(texel.x, 0.0)).b;
      hR = texture2D(uTextMap, texUv + vec2(texel.x, 0.0)).b;
      hD = texture2D(uTextMap, texUv - vec2(0.0, texel.y)).b;
      hU = texture2D(uTextMap, texUv + vec2(0.0, texel.y)).b;
    }

    float hC = cC.b;

    // Realistic ink bleed: darker crisp core with a softer feathered halo into paper fibers
    float neighborAvg = (hL + hR + hD + hU) * 0.25;
    float haloMask = clamp(neighborAvg * 0.85 + fiber * 0.25 * neighborAvg, 0.0, 1.0);
    float coreMask = smoothstep(0.22, 0.72, hC);
    float inkMask  = clamp(max(coreMask, haloMask * 0.68), 0.0, 1.0);

    // Finite-difference normal perturbation for visible letterpress deboss indentation
    float dX = (hR - hL) * 6.5 + fiber * 0.10;
    float dY = (hU - hD) * 6.5 + fiber * 0.10;
    vec3 perturbedNormal = normalize(vWorldNormal + vec3(-dX, -dY, 0.0) * 0.52);

    // Warm archival cotton paper color + subtle edge shading
    vec3 paperCol = vec3(0.972, 0.942, 0.875) + fiber * 0.026;
    float sideEdge = smoothstep(0.0, 0.025, vUv.x) * smoothstep(1.0, 0.975, vUv.x);
    float topEdge  = smoothstep(1.0, 0.96, vUv.y);
    paperCol *= (0.93 + 0.07 * sideEdge * topEdge);

    // Rich carbon-black ink (darker core, warm charcoal halo) & crimson bichrome red ink
    float redRatio = clamp(cC.g / max(0.001, cC.r + cC.g), 0.0, 1.0);
    vec3 blackInk = mix(vec3(0.20, 0.18, 0.16), vec3(0.015, 0.015, 0.02), coreMask);
    vec3 redInk   = mix(vec3(0.75, 0.20, 0.15), vec3(0.42, 0.04, 0.03), coreMask);
    vec3 inkCol   = mix(blackInk, redInk, redRatio);

    vec3 baseAlbedo = mix(paperCol, inkCol, smoothstep(0.04, 0.52, inkMask));

    // Directional studio lighting + letterpress deboss highlight/shadow bevel
    float diff = max(dot(perturbedNormal, uLightDir), 0.0);
    float debossBevel = clamp((hU - hD) * 2.8 + (hL - hR) * 1.9, -0.32, 0.35);

    // Soft shadow cast by the platen & bail bar onto the lower curve of the paper
    float platenCurveShadow = smoothstep(0.06, 0.28, vArchFactor) * 0.32 + 0.68;
    float bailShadow = 1.0 - exp(-pow((vArchFactor - 0.245) * 42.0, 2.0)) * 0.18;

    vec3 finalCol = baseAlbedo * (0.54 + diff * 0.52) * platenCurveShadow * bailShadow + vec3(debossBevel * 0.18);
    gl_FragColor = vec4(finalCol, 1.0);
  }
`;
