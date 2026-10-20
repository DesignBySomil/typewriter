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

  void main() {
    vec2 aspectUv = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    float dist = length(aspectUv);

    // Seamless matte dark studio backdrop matching the desk surface tone (zero horizon band)
    vec3 centerCol = vec3(0.115, 0.104, 0.095);
    vec3 edgeCol   = vec3(0.038, 0.034, 0.031);
    vec3 col = mix(centerCol, edgeCol, smoothstep(0.0, 1.15, dist));

    // Very soft upper-left studio softbox ambient falloff
    float softboxFalloff = exp(-length(aspectUv - vec2(-0.22, 0.24)) * 2.2);
    col += vec3(0.032, 0.028, 0.022) * softboxFalloff;

    // Very mild analog film grain
    float grain = (hash21(vUv * uResolution + fract(uTime * 11.7)) - 0.5) * 0.015;
    col += grain;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;
