/**
 * Route shader for evacuation path visualization.
 * Creates a flowing, pulsing tube animation that indicates direction of travel.
 */

export const routeVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const routeFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uGlowColor;
  uniform float uSpeed;
  uniform float uPulseWidth;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    // Flowing pulse along the tube (UV.x runs along the path)
    float flow = fract(vUv.x * 4.0 - uTime * uSpeed);

    // Sharp pulse bands
    float pulse = smoothstep(0.0, uPulseWidth, flow) *
                  (1.0 - smoothstep(uPulseWidth, uPulseWidth * 2.0, flow));

    // Fresnel edge glow
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    fresnel = pow(fresnel, 1.5);

    // Combine base color with pulse and glow
    vec3 baseColor = mix(uColor, uGlowColor, 0.3);
    vec3 pulseColor = mix(baseColor, uGlowColor, pulse * 0.8);
    vec3 finalColor = pulseColor + uGlowColor * fresnel * 0.4;

    // Alpha: always visible with brighter pulses
    float alpha = 0.6 + pulse * 0.3 + fresnel * 0.1;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;
