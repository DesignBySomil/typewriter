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

    float heightRatio = clamp(uv.y, 0.0, 1.0);
    vArchFactor = heightRatio;

    // Subtle mechanical flutter when line-feeding or inserting a sheet
    float flutter = sin(uv.y * 15.0 - uTime * 22.0) * uFeedWave * 0.032 * heightRatio;

    // Sheet insertion slide animation
    float slideOffset = (1.0 - uInsertProgress) * 1.80;
    pos.y -= slideOffset * heightRatio;
    pos.z += flutter;

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
    // 80gsm Bond Paper UV Mapping:
    // vUv.y = 0.30 is the active print line sitting right above the platen & paper bail bar.
    float vFromPrintPoint = vUv.y - 0.30;
    float texV = 0.0967 + vFromPrintPoint * 0.42 + uScrollV;
    vec2 texUv = vec2(vUv.x, texV);

    // Multi-octave 80gsm cotton bond paper fiber & visible laid pulp grain
    vec2 fiberCoord = vUv * vec2(145.0, 175.0);
    float fw = length(fwidth(fiberCoord));
    float fiberFade = 1.0 - smoothstep(0.35, 1.2, fw);
    float f1 = noise(fiberCoord);
    float f2 = noise(vUv * vec2(320.0, 90.0));
    float lowPulp = noise(vUv * vec2(14.0, 18.0)) - 0.5;
    float fiber = ((f1 * 0.62 + f2 * 0.38) - 0.5) * fiberFade;

    // Sample RGBA CanvasTexture:
    // R = Black ink density, G = Red bichrome ink density, B = letterpress deboss heightfield
    vec2 texel = vec2(1.2 / 2048.0);
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

    // Ink sinks into the 80gsm bond fibers (soft wicking halo + crisp dark core + tiny ink specks)
    float neighborAvg = (hL + hR + hD + hU) * 0.25;
    float wickingHalo = clamp(neighborAvg * 0.92 + fiber * 0.32 * neighborAvg, 0.0, 1.0);
    float coreMask = smoothstep(0.16, 0.68, hC) * (0.94 + fiber * 0.12);
    float inkMask  = clamp(max(coreMask, wickingHalo * 0.65), 0.0, 1.0);

    // Finite-difference normal perturbation for tactile letterpress deboss indentation
    float dX = (hR - hL) * 6.0 + fiber * 0.11;
    float dY = (hU - hD) * 6.0 + fiber * 0.11;
    vec3 perturbedNormal = normalize(vWorldNormal + vec3(-dX, -dY, 0.0) * 0.48);

    // Warm off-white 80gsm archival bond paper color + slightly yellowed vintage edges
    vec3 paperCol = vec3(0.946, 0.916, 0.852) + fiber * 0.032 + lowPulp * 0.016;
    float edgeNoise = noise(vUv * 12.0) * 0.018;
    float distToSideEdge = min(vUv.x, 1.0 - vUv.x);
    float distToTopEdge  = 1.0 - vUv.y;
    float edgeYellowMask = (1.0 - smoothstep(0.0, 0.11 + edgeNoise, distToSideEdge))
                         + (1.0 - smoothstep(0.0, 0.09 + edgeNoise, distToTopEdge)) * 0.75;
    edgeYellowMask = clamp(edgeYellowMask, 0.0, 1.0);

    vec3 yellowedEdgeTone = vec3(0.865, 0.805, 0.685);
    paperCol = mix(paperCol, yellowedEdgeTone, edgeYellowMask * 0.55);

    float sideEdgeAO = smoothstep(0.0, 0.025 + edgeNoise, vUv.x) * smoothstep(1.0, 0.975 - edgeNoise, vUv.x);
    float topCurlShade = 1.0 - smoothstep(0.72, 1.0, vUv.y) * 0.13;
    paperCol *= (0.92 + 0.08 * sideEdgeAO) * topCurlShade;

    // Crisp dark absorbed carbon-black ink & muted crimson ribbon ink
    float redRatio = clamp(cC.g / max(0.001, cC.r + cC.g), 0.0, 1.0);
    vec3 blackInk = mix(vec3(0.20, 0.18, 0.16), vec3(0.032, 0.030, 0.034), coreMask);
    vec3 redInk   = mix(vec3(0.70, 0.22, 0.17), vec3(0.40, 0.06, 0.05), coreMask);
    vec3 inkCol   = mix(blackInk, redInk, redRatio);

    vec3 baseAlbedo = mix(paperCol, inkCol, smoothstep(0.04, 0.50, inkMask));

    // Matte softbox diffuse lighting + subtle letterpress deboss bevel
    float diff = max(dot(perturbedNormal, uLightDir), 0.0);
    float debossBevel = clamp((hU - hD) * 2.2 + (hL - hR) * 1.5, -0.22, 0.24);

    // Soft contact shadow from the platen & paper bail onto the paper just below and above the print line
    float platenWrapShadow = smoothstep(0.05, 0.27, vArchFactor) * 0.32 + 0.68;
    float bailContactShadow = 1.0 - exp(-pow((vArchFactor - 0.255) * 30.0, 2.0)) * 0.22;
    float abovePrintSoftShadow = 1.0 - exp(-pow((vArchFactor - 0.335) * 18.0, 2.0)) * 0.09;

    vec3 finalCol = baseAlbedo * (0.60 + diff * 0.44) * platenWrapShadow * bailContactShadow * abovePrintSoftShadow
                  + vec3(debossBevel * 0.12);
    gl_FragColor = vec4(finalCol, 1.0);
  }
`;
