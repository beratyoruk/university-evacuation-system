/**
 * Pulse shader for user location marker.
 * Creates a glowing, pulsing sphere effect.
 */

export const pulseVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    // Subtle vertex displacement for breathing effect
    float pulse = 1.0 + sin(uTime * 3.0) * 0.05;
    vec3 displaced = position * pulse;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const pulseFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uGlowColor;
  uniform float uIntensity;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  void main() {
    // Fresnel-based rim glow
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    fresnel = pow(fresnel, 2.0);

    // Time-based pulse
    float pulse = 0.5 + 0.5 * sin(uTime * 3.0);

    // Core color with glow edge
    vec3 core = mix(uColor, uGlowColor, fresnel);
    float alpha = mix(0.8, 1.0, fresnel) * (0.8 + 0.2 * pulse);

    // Emissive glow contribution
    vec3 emission = uGlowColor * fresnel * uIntensity * (0.6 + 0.4 * pulse);

    gl_FragColor = vec4(core + emission, alpha);
  }
`;
