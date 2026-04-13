import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { pulseVertexShader, pulseFragmentShader } from "./shaders/pulse";

interface UserMarkerProps {
  /** User X position in floor coordinates */
  x: number;
  /** User Y position in floor coordinates */
  y: number;
}

/**
 * UserMarker - Renders the user's position as a glowing blue sphere
 * with a pulsing ring animation on the ground plane.
 *
 * Uses smooth interpolation (lerp) to transition between position
 * updates, creating fluid movement rather than snapping.
 */
export default function UserMarker({ x, y }: UserMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  // Target position for lerp interpolation
  const targetPos = useRef(new THREE.Vector3(x, 1.0, y));

  // Update target when props change
  useMemo(() => {
    targetPos.current.set(x, 1.0, y);
  }, [x, y]);

  // Shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#3b82f6") },
      uGlowColor: { value: new THREE.Color("#60a5fa") },
      uIntensity: { value: 1.5 },
    }),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Smooth lerp towards target position
    if (groupRef.current) {
      groupRef.current.position.lerp(targetPos.current, 0.08);
    }

    // Sphere bob animation
    if (sphereRef.current) {
      sphereRef.current.position.y = Math.sin(t * 2) * 0.1;
    }

    // Pulse ring animation
    if (pulseRef.current) {
      const scale = 1 + Math.sin(t * 3) * 0.4;
      pulseRef.current.scale.set(scale, scale, 1);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.4 - Math.sin(t * 3) * 0.2;
    }

    // Update shader time
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = t;
    }
  });

  return (
    <group ref={groupRef} position={[x, 1.0, y]}>
      {/* Main sphere with glow shader */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <shaderMaterial
          ref={shaderRef}
          vertexShader={pulseVertexShader}
          fragmentShader={pulseFragmentShader}
          uniforms={uniforms}
          transparent
        />
      </mesh>

      {/* Outer glow sphere */}
      <mesh>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Pulse ring on ground */}
      <mesh ref={pulseRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, 0]}>
        <ringGeometry args={[0.4, 0.9, 32]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Small direction indicator (vertical line) */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
        <meshBasicMaterial color="#93c5fd" />
      </mesh>
    </group>
  );
}
