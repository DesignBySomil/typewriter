export const BACKGROUND_VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const BACKGROUND_FRAGMENT_SHADER = /* glsl */`
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float dustLayer(vec2 uv, float scale, float speed, float seed) {
    vec2 p = uv * scale;
    p.y -= uTime * speed;
    p.x += sin(uTime * 0.28 + seed + uv.y * 3.2) * 0.38;
    vec2 id = floor(p);
    vec2 f = fract(p) - 0.5;
    float h = hash21(id + seed);
    if (h < 0.90) return 0.0;
    vec2 offset = vec2(fract(h * 13.7) - 0.5, fract(h * 29.3) - 0.5) * 0.52;
    float d = length(f - offset);
    float twinkle = 0.5 + 0.5 * sin(uTime * 2.1 + h * 62.8);
    return smoothstep(0.09, 0.0, d) * twinkle * (h - 0.90) * 10.5;
  }

  void main() {
    vec2 aspectUv = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    float dist = length(aspectUv);

    // Warm dark studio vignette gradient
    vec3 centerCol = vec3(0.18, 0.145, 0.118);
    vec3 edgeCol   = vec3(0.032, 0.027, 0.024);
    vec3 col = mix(centerCol, edgeCol, smoothstep(0.05, 1.08, dist));

    // Warm upper key-light volumetriccone glow
    float topGlow = exp(-length(aspectUv - vec2(-0.12, 0.28)) * 2.1);
    col += vec3(0.095, 0.064, 0.035) * topGlow;

    // 3 parallax layers of slow floating dust motes catching the studio light
    float dust = 0.0;
    dust += dustLayer(aspectUv, 7.5,  0.045, 1.1) * 0.65;
    dust += dustLayer(aspectUv, 13.5, 0.075, 4.7) * 0.45;
    dust += dustLayer(aspectUv, 21.0, 0.105, 9.3) * 0.30;
    col += vec3(0.98, 0.82, 0.58) * dust * smoothstep(1.0, 0.15, dist);

    // Subtle analog film grain
    float grain = (hash21(vUv * uResolution + fract(uTime * 17.3)) - 0.5) * 0.022;
    col += grain;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;
