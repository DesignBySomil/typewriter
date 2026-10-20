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
    float flutter = sin(uv.y * 15.0 - uTime * 24.0) * uFeedWave * 0.042 * heightRatio;
    float topCurl = pow(heightRatio, 2.3) * 0.11;

    // Sheet insertion slide animation (slides up out of the platen on load / new sheet)
    float slideOffset = (1.0 - uInsertProgress) * 2.6;
    pos.y -= slideOffset * heightRatio;
    pos.z += flutter - topCurl;

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
    // Map paper mesh UV onto the upright CanvasTexture (with flipY = true):
    // vUv.x: 0 (left) -> 1 (right)
    // vUv.y: 0.24 is the printing point on the front of the platen; 1.0 is the top of the sheet.
    // At vUv.y = 0.24, we want canvas Y = paperActiveLineCanvasY (1840 / 2048 = 0.8984 from top, so Texture V = 1.0 - 0.8984 = 0.1016).
    // As vUv.y increases above 0.24 toward 1.0, Texture V increases upward so older lines appear above the printing point!
    float vFromPrintPoint = vUv.y - 0.24;
    float texV = 0.1016 + vFromPrintPoint * 0.78 + uScrollV;
    vec2 texUv = vec2(vUv.x, texV);

    // Multi-octave archival cotton paper fiber noise
    float f1 = noise(vUv * vec2(190.0, 230.0));
    float f2 = noise(vUv * vec2(440.0, 110.0));
    float fiber = (f1 * 0.62 + f2 * 0.38) - 0.5;

    // Sample RGBA CanvasTexture:
    // R = Black ink height/density, G = Red bichrome ink height/density, B = total deboss heightfield
    vec2 texel = vec2(1.0 / 2048.0);
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

    // Ink bleed into surrounding cotton paper fibers
    float neighborAvg = (hL + hR + hD + hU) * 0.25;
    float inkMask = clamp(max(hC, neighborAvg * 0.78 + fiber * 0.22 * neighborAvg), 0.0, 1.0);

    // Compute finite-difference normal perturbation for tactile letterpress deboss
    float dX = (hR - hL) * 4.8 + fiber * 0.13;
    float dY = (hU - hD) * 4.8 + fiber * 0.13;
    vec3 perturbedNormal = normalize(vWorldNormal + vec3(-dX, -dY, 0.0) * 0.42);

    // Warm archival cream paper tone + subtle ruled margin guide lines
    vec3 paperCol = vec3(0.965, 0.935, 0.865) + fiber * 0.028;
    float edgeVignette = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x);
    paperCol *= (0.93 + 0.07 * edgeVignette);

    // Determine whether glyph was struck with Black or Red half of the bichrome ribbon
    float redRatio = clamp(cC.g / max(0.001, cC.r + cC.g), 0.0, 1.0);
    vec3 blackInk = mix(vec3(0.14, 0.12, 0.11), vec3(0.03, 0.03, 0.04), smoothstep(0.25, 0.85, hC));
    vec3 redInk   = mix(vec3(0.68, 0.16, 0.12), vec3(0.45, 0.06, 0.05), smoothstep(0.25, 0.85, hC));
    vec3 inkCol   = mix(blackInk, redInk, redRatio);

    vec3 baseAlbedo = mix(paperCol, inkCol, smoothstep(0.08, 0.62, inkMask));

    // Directional studio lighting + letterpress deboss micro-rim
    float diff = max(dot(perturbedNormal, uLightDir), 0.0);
    float debossRim = clamp((hU - hD) * 2.1 + (hL - hR) * 1.4, -0.25, 0.28);
    float platenAO = smoothstep(0.0, 0.20, vArchFactor) * 0.28 + 0.72;

    vec3 finalCol = baseAlbedo * (0.48 + diff * 0.56) * platenAO + vec3(debossRim * 0.15);
    gl_FragColor = vec4(finalCol, 1.0);
  }
`;
