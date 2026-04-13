import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { routeVertexShader, routeFragmentShader } from "./shaders/route";

interface RouteVisualizerProps {
  /** Ordered coordinates of the evacuation route */
  coordinates: Array<{ x: number; y: number }>;
}

const TUBE_RADIUS = 0.12;
const TUBE_SEGMENTS = 64;
const RADIAL_SEGMENTS = 8;
const ROUTE_HEIGHT = 0.3; // Slight elevation above ground
const ARROW_SPACING = 5; // Distance between arrow markers in meters

/**
 * RouteVisualizer - Renders the evacuation route as an animated
 * tube with directional arrow markers.
 *
 * The tube uses a custom shader for a pulsing "flow" animation
 * that visually indicates the direction of travel.
 * Arrow cones are placed along the route at regular intervals.
 */
export default function RouteVisualizer({ coordinates }: RouteVisualizerProps) {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  // Build a smooth curve from the coordinate points
  const { curve, totalLength } = useMemo(() => {
    if (coordinates.length < 2) return { curve: null, totalLength: 0 };

    const points = coordinates.map(
      (c) => new THREE.Vector3(c.x, ROUTE_HEIGHT, c.y)
    );
    const c = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
    return { curve: c, totalLength: c.getLength() };
  }, [coordinates]);

  // Compute arrow positions along the curve
  const arrows = useMemo(() => {
    if (!curve || totalLength < ARROW_SPACING) return [];

    const arrowList: Array<{ position: THREE.Vector3; direction: THREE.Vector3 }> = [];
    const count = Math.floor(totalLength / ARROW_SPACING);

    for (let i = 1; i <= count; i++) {
      const t = (i * ARROW_SPACING) / totalLength;
      if (t >= 1) break;
      const pos = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      arrowList.push({ position: pos, direction: tangent });
    }

    return arrowList;
  }, [curve, totalLength]);

  // Shader uniforms for pulse animation
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#f59e0b") },
      uGlowColor: { value: new THREE.Color("#fbbf24") },
      uSpeed: { value: 2.0 },
      uPulseWidth: { value: 0.15 },
    }),
    []
  );

  // Animate the shader
  useFrame(({ clock }) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  if (!curve || coordinates.length < 2) return null;

  return (
    <group>
      {/* Animated route tube */}
      <mesh>
        <tubeGeometry args={[curve, TUBE_SEGMENTS, TUBE_RADIUS, RADIAL_SEGMENTS, false]} />
        <shaderMaterial
          ref={shaderRef}
          vertexShader={routeVertexShader}
          fragmentShader={routeFragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer glow tube */}
      <mesh>
        <tubeGeometry args={[curve, TUBE_SEGMENTS, TUBE_RADIUS * 2.5, RADIAL_SEGMENTS, false]} />
        <meshBasicMaterial
          color="#f59e0b"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Direction arrows along the path */}
      {arrows.map((arrow, i) => (
        <ArrowMarker
          key={i}
          position={arrow.position}
          direction={arrow.direction}
        />
      ))}

      {/* Start marker */}
      {coordinates.length > 0 && (
        <mesh position={[coordinates[0].x, ROUTE_HEIGHT + 0.3, coordinates[0].y]}>
          <octahedronGeometry args={[0.25, 0]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#f59e0b"
            emissiveIntensity={0.5}
          />
        </mesh>
      )}

      {/* End marker (exit) */}
      {coordinates.length > 1 && (
        <EndMarker
          x={coordinates[coordinates.length - 1].x}
          y={coordinates[coordinates.length - 1].y}
        />
      )}
    </group>
  );
}

/** Single directional arrow cone along the route. */
function ArrowMarker({
  position,
  direction,
}: {
  position: THREE.Vector3;
  direction: THREE.Vector3;
}) {
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    // Align cone (default Y-up) to the tangent direction
    const up = new THREE.Vector3(0, 1, 0);
    q.setFromUnitVectors(up, direction);
    return q;
  }, [direction]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <coneGeometry args={[0.2, 0.5, 8]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive="#f59e0b"
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}

/** Pulsing marker at the evacuation exit point. */
function EndMarker({ x, y }: { x: number; y: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.2;
      meshRef.current.scale.setScalar(s);
    }
  });

  return (
    <group position={[x, ROUTE_HEIGHT, y]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={0.8}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]}>
        <ringGeometry args={[0.6, 1.0, 32]} />
        <meshBasicMaterial
          color="#22c55e"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
