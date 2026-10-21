export const PAPER_VERTEX_SHADER = /* glsl */`
  uniform float uTime;
  uniform float uFeedWave;
  uniform float uInsertProgress;
  uniform float uScrollV;
  uniform float uPaperRadius;
  uniform float uPaperWidth;
  uniform float uTotalSheetLen;
  uniform float uLineStepWorld;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vPathS;

  /**
   * Evaluates a point and surface normal along the physical platen + rear paper table path
   * parameterized by arc-length s (in world units):
   * - s = 0.0 is the bottom entry behind the platen
   * - s = 0.86 is the front platen contact point
   * - s = 1.15 is where the sheet leaves the upper platen and rises above the machine
   * - At Line 0 (uScrollV = 0), the top edge of the sheet (uv.y = 1.0) sits at s = 4.10,
   *   which is 4.10 - 1.15 = 2.95 world units (CONFIG.paperSheetHeight) above the platen top!
   */
  void evaluatePaperPath(float s, float vx, out vec3 outPos, out vec3 outNorm) {
    float r = uPaperRadius;
    float wrapBottomLen = 0.86;
    float wrapTopLen = 0.29;
    float tableStartS = wrapBottomLen + wrapTopLen; // 1.15 world units

    float py = 0.0;
    float pz = 0.0;
    vec3 n = vec3(0.0, 0.0, 1.0);

    if (s < 0.0) {
      // Below the platen entry: tuck down and behind the roller inside the chassis
      float d = -s;
      float angle = -1.6336; // -0.52 * PI
      py = sin(angle) * r - d * 0.85;
      pz = cos(angle) * r - d * 0.52;
      n = normalize(vec3(0.0, sin(angle), cos(angle)));
    } else if (s < wrapBottomLen) {
      // Wrap around bottom-front of platen cylinder up to the printing point (angle = 0)
      float t = s / wrapBottomLen;
      float angle = -1.6336 * (1.0 - t);
      py = sin(angle) * r;
      pz = cos(angle) * r;
      n = normalize(vec3(0.0, sin(angle), cos(angle)));
    } else if (s < tableStartS) {
      // Transition over the upper-front of the platen past the paper bail
      float t = (s - wrapBottomLen) / wrapTopLen;
      float angle = t * 0.6597; // 0.21 * PI
      py = sin(angle) * r;
      pz = cos(angle) * r;
      n = normalize(vec3(0.0, sin(angle), cos(angle)));
    } else {
      // Rise up along and above the tilted rear paper support table
      // Important: keep the paper slightly in front of the rear paperTableMesh (which sits at z = -0.86)
      // and use a gentle, bounded top curl so the rising sheet NEVER intersects the green back panel!
      float distAbove = s - tableStartS;
      float baseAngle = 0.6597;
      float startY = sin(baseAngle) * r;
      float startZ = cos(baseAngle) * r;

      float hNorm = clamp(distAbove / 2.95, 0.0, 1.0);
      float topCurlZ = pow(hNorm, 2.4) * 0.24 - sin(hNorm * 3.14159) * 0.05;
      float topCurlY = -pow(hNorm, 3.0) * 0.10;
      float edgeLiftZ = pow(vx / (uPaperWidth * 0.5), 2.0) * pow(hNorm, 1.8) * 0.075;

      py = startY + distAbove * cos(0.20) + topCurlY;
      pz = startZ - distAbove * sin(0.20) - topCurlZ + edgeLiftZ;

      float bend = pow(hNorm, 1.5) * 0.18;
      n = normalize(vec3(0.0, sin(0.20 + bend), cos(0.20 + bend)));
    }

    outPos = vec3(vx, py, pz);
    outNorm = n;
  }

  void main() {
    vUv = uv;
    float vx = position.x;

    // Convert uScrollV (-line * 70 / 2048) to continuous fractional line index (0..24)
    float currentLine = clamp((-uScrollV * 2048.0) / 70.0, 0.0, 24.0);

    // Physical sheet feed in world units:
    // At currentLine = 0, feedWorld = 0.0, and the top edge (uv.y = 1.0) sits at s = 4.10
    // (1.15 platen wrap + 2.95 CONFIG.paperSheetHeight = 4.10 world units, standing 2.95 units above platen!).
    // As currentLine increases (winding UP or carriage return), feedWorld increases by currentLine * uLineStepWorld,
    // raising the entire sheet and its top edge while the 11.5-unit-long sheet keeps the bottom hidden behind the platen!
    float feedWorld = currentLine * uLineStepWorld;

    // Sheet insertion / pull-out offset along the path
    float insertOffset = 0.0;
    if (uInsertProgress < 1.0) {
      insertOffset = -(1.0 - uInsertProgress) * 3.10;
    } else if (uInsertProgress > 1.0) {
      insertOffset = (uInsertProgress - 1.0) * 3.80;
    }

    float sTopAtLine0 = 1.15 + 2.95; // 4.10 world units
    float s = sTopAtLine0 - (1.0 - uv.y) * uTotalSheetLen + feedWorld + insertOffset;
    vPathS = s;

    vec3 pathPos;
    vec3 pathNorm;
    evaluatePaperPath(s, vx, pathPos, pathNorm);

    // Subtle mechanical flutter when line-feeding or inserting/removing a sheet
    float abovePlaten = smoothstep(0.85, 2.8, s);
    float flutter = sin(uv.y * 18.0 - uTime * 22.0) * uFeedWave * 0.030 * abovePlaten;
    pathPos += pathNorm * flutter;

    vec4 worldPos = modelMatrix * vec4(pathPos, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * pathNorm);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const PAPER_FRAGMENT_SHADER = /* glsl */`
  uniform sampler2D uTextMap;
  uniform float uTime;
  uniform float uScrollV;
  uniform float uTotalSheetLen;
  uniform float uLineStepWorld;
  uniform vec3 uLightDir;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vPathS;

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
    // Discard the un-fed lower portion of the sheet tucked inside the chassis below the platen entry
    if (vPathS < 0.12) {
      discard;
    }

    // Ensure two-sided normal always faces the light/camera so DoubleSide never turns dark
    vec3 baseNormal = gl_FrontFacing ? normalize(vWorldNormal) : -normalize(vWorldNormal);

    // Text is GLUED directly to the physical sheet coordinates (vUv.x, vUv.y):
    // At Line 0 (feedWorld = 0), the active strike point on the front of the platen is at s = 1.02.
    // The distance from the top edge of the sheet (sTopAtLine0 = 4.10) to the Line 0 strike point (s = 1.02)
    // is 4.10 - 1.02 = 3.08 world units along the sheet from the top edge.
    // Wait: at Line 0, we want the strike point (s = 1.02) to print Line 0, AND any text already typed on
    // Line 0..L to ride glued to the sheet!
    // Specifically, a point at distance distFromTopWorld = (1.0 - vUv.y) * uTotalSheetLen from the top edge
    // has world path coordinate s = 4.10 - distFromTopWorld + currentLine * uLineStepWorld.
    // Setting s = 1.02 (the strike line right above the ribbon vibrator) gives:
    //   distFromTopWorld = 3.08 + currentLine * uLineStepWorld
    //   -> lineOnSheet = (distFromTopWorld - 3.08) / uLineStepWorld == currentLine!
    // And on the canvas, Line 0 is drawn at canvas Y = 250px (Texture V = 1.0 - 250/2048 = 0.8779),
    // with each subsequent line 70px lower (Texture V decreases by 70/2048 per line).
    float distFromTopWorld = (1.0 - vUv.y) * uTotalSheetLen;
    float lineOnSheet = (distFromTopWorld - 3.08) / uLineStepWorld;
    float texV = 0.8779 - lineOnSheet * (70.0 / 2048.0);
    vec2 texUv = vec2(vUv.x, texV);

    // Multi-octave 80gsm cotton bond paper fiber & visible laid pulp grain (glued to vUv so fibers move with sheet)
    vec2 fiberCoord = vUv * vec2(145.0, 280.0);
    float fw = length(fwidth(fiberCoord));
    float fiberFade = 1.0 - smoothstep(0.35, 1.2, fw);
    float f1 = noise(fiberCoord);
    float f2 = noise(vUv * vec2(320.0, 150.0));
    float lowPulp = noise(vUv * vec2(14.0, 28.0)) - 0.5;
    float fiber = ((f1 * 0.62 + f2 * 0.38) - 0.5) * fiberFade;

    vec2 texel = vec2(1.2 / 2048.0);
    vec4 cC = vec4(0.0);
    float hL = 0.0;
    float hR = 0.0;
    float hD = 0.0;
    float hU = 0.0;

    // Sample ink texture across the sheet (at or above the platen strike zone vPathS >= 0.86)
    if (vPathS >= 0.86 && texUv.y >= 0.01 && texUv.y <= 0.99 && texUv.x >= 0.01 && texUv.x <= 0.99) {
      cC = texture2D(uTextMap, texUv);
      hL = texture2D(uTextMap, texUv - vec2(texel.x, 0.0)).b;
      hR = texture2D(uTextMap, texUv + vec2(texel.x, 0.0)).b;
      hD = texture2D(uTextMap, texUv - vec2(0.0, texel.y)).b;
      hU = texture2D(uTextMap, texUv + vec2(0.0, texel.y)).b;
    }

    float hC = cC.b;

    // Ink sinks into the 80gsm bond fibers
    float neighborAvg = (hL + hR + hD + hU) * 0.25;
    float inkPresent = clamp(cC.r + cC.g, 0.0, 1.0);
    float wickingHalo = clamp(neighborAvg * 0.92 + fiber * 0.32 * neighborAvg, 0.0, 1.0) * smoothstep(0.0, 0.2, inkPresent);
    float coreMask = smoothstep(0.16, 0.68, inkPresent) * (0.94 + fiber * 0.12);
    float inkMask  = clamp(max(coreMask, wickingHalo * 0.65), 0.0, 1.0);

    // Finite-difference normal perturbation for tactile letterpress deboss indentation
    float dX = (hR - hL) * 6.0 + fiber * 0.11;
    float dY = (hU - hD) * 6.0 + fiber * 0.11;
    vec3 perturbedNormal = normalize(baseNormal + vec3(-dX, -dY, 0.0) * 0.48);

    // Warm off-white 80gsm archival bond paper color + slightly yellowed vintage edges
    vec3 paperCol = vec3(0.946, 0.916, 0.852) + fiber * 0.032 + lowPulp * 0.016;
    float edgeNoise = noise(vUv * 12.0) * 0.018;
    float distToSideEdge = min(vUv.x, 1.0 - vUv.x);
    float distToTopEdge  = 1.0 - vUv.y;
    float edgeYellowMask = (1.0 - smoothstep(0.0, 0.11 + edgeNoise, distToSideEdge))
                         + (1.0 - smoothstep(0.0, 0.06 + edgeNoise, distToTopEdge)) * 0.85;
    edgeYellowMask = clamp(edgeYellowMask, 0.0, 1.0);

    vec3 yellowedEdgeTone = vec3(0.855, 0.795, 0.672);
    paperCol = mix(paperCol, yellowedEdgeTone, edgeYellowMask * 0.58);

    // Subtle cut-edge shadow right at the top and side borders so the rising top edge reads crisply
    float sideEdgeAO = smoothstep(0.0, 0.025 + edgeNoise, vUv.x) * smoothstep(1.0, 0.975 - edgeNoise, vUv.x);
    float topEdgeAO  = smoothstep(1.0, 0.990, vUv.y);
    float topCurlShade = 1.0 - smoothstep(3.4, 5.2, vPathS) * 0.10;
    paperCol *= (0.91 + 0.09 * sideEdgeAO * topEdgeAO) * topCurlShade;

    // Crisp dark absorbed carbon-black ink & muted crimson ribbon ink
    float redRatio = clamp(cC.g / max(0.001, cC.r + cC.g), 0.0, 1.0);
    vec3 blackInk = mix(vec3(0.20, 0.18, 0.16), vec3(0.032, 0.030, 0.034), coreMask);
    vec3 redInk   = mix(vec3(0.70, 0.22, 0.17), vec3(0.40, 0.06, 0.05), coreMask);
    vec3 inkCol   = mix(blackInk, redInk, redRatio);

    vec3 baseAlbedo = mix(paperCol, inkCol, smoothstep(0.04, 0.50, inkMask));

    // Matte softbox diffuse lighting + subtle letterpress deboss bevel
    float diff = max(dot(perturbedNormal, uLightDir), 0.0);
    float debossBevel = clamp((hU - hD) * 2.2 + (hL - hR) * 1.5, -0.22, 0.24);

    // Soft contact shadow along the platen wrap & paper bail bar (anchored in world path space vPathS)
    float platenWrapShadow = smoothstep(0.14, 0.88, vPathS) * 0.32 + 0.68;
    float bailContactShadow = 1.0 - exp(-pow((vPathS - 0.90) * 8.5, 2.0)) * 0.22;
    float abovePrintSoftShadow = 1.0 - exp(-pow((vPathS - 1.18) * 5.5, 2.0)) * 0.09;

    vec3 finalCol = baseAlbedo * (0.62 + diff * 0.42) * platenWrapShadow * bailContactShadow * abovePrintSoftShadow
                  + vec3(debossBevel * 0.12);
    gl_FragColor = vec4(finalCol, 1.0);
  }
`;
