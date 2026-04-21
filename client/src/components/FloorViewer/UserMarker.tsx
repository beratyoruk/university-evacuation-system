import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { pulseVertexShader, pulseFragmentShader } from "./shaders/pulse";

interface UserMarkerProps {
  /** User X position in floor coordinates */
  x: number;
  /** User Y position in floor coordinates */
  y: number;
  /** GPS accuracy in meters — drives the ground-plane accuracy ring */
  accuracy?: number | null;
  /** Compass heading in degrees clockwise from "plan north" (0..360) */
  heading?: number | null;
}

const TRAIL_MAX = 24;
const TRAIL_MIN_STEP_M = 0.5;
/** Clamp accuracy ring so a 100m fix doesn't fill the whole plan */
const ACCURACY_MAX = 60;
const ACCURACY_MIN = 0.8;

/**
 * UserMarker - Renders the user's position as a glowing blue sphere
 * with a pulsing ring, GPS accuracy disc, heading arrow, and recent-position
 * breadcrumb trail. Designed for real-time evacuation tracking: every motion
 * the user makes is reflected immediately.
 */
export default function UserMarker({ x, y, accuracy = null, heading = null }: UserMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const headingRef = useRef<THREE.Group>(null);

  const targetPos = useRef(new THREE.Vector3(x, 1.0, y));
  useMemo(() => { targetPos.current.set(x, 1.0, y); }, [x, y]);

  // Recent positions for the breadcrumb trail.
  const [trail, setTrail] = useState<Array<[number, number]>>([]);
  const lastPushRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    const last = lastPushRef.current;
    if (last && Math.hypot(last[0] - x, last[1] - y) < TRAIL_MIN_STEP_M) return;
    lastPushRef.current = [x, y];
    setTrail((prev) => {
      const next: Array<[number, number]> = [...prev, [x, y]];
      if (next.length > TRAIL_MAX) next.shift();
      return next;
    });
  }, [x, y]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#3b82f6") },
      uGlowColor: { value: new THREE.Color("#60a5fa") },
      uIntensity: { value: 1.5 },
    }),
    []
  );

  // Target heading in radians (three.js Y-axis rotation).
  // heading is clockwise from plan-north; in our scene +Z = plan +Y.
  // Positive Y-rotation in three.js rotates +Z toward -X (right-hand rule), so
  // we negate to align heading=90° (east) with +X.
  const targetYaw = useRef(0);
  useEffect(() => {
    if (heading == null || !Number.isFinite(heading)) return;
    targetYaw.current = -(heading * Math.PI) / 180;
  }, [heading]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Snap-to-target is proportional; Kalman already smooths upstream.
    if (groupRef.current) {
      groupRef.current.position.lerp(targetPos.current, 0.2);
    }

    if (sphereRef.current) {
      sphereRef.current.position.y = Math.sin(t * 2) * 0.1;
    }

    if (pulseRef.current) {
      const scale = 1 + Math.sin(t * 3) * 0.4;
      pulseRef.current.scale.set(scale, scale, 1);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.4 - Math.sin(t * 3) * 0.2;
    }

    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = t;
    }

    // Smoothly rotate arrow toward target heading (shortest path).
    if (headingRef.current && heading != null) {
      const cur = headingRef.current.rotation.y;
      let delta = targetYaw.current - cur;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      headingRef.current.rotation.y = cur + delta * 0.25;
    }
  });

  const ringR = accuracy != null && Number.isFinite(accuracy)
    ? Math.min(ACCURACY_MAX, Math.max(ACCURACY_MIN, accuracy))
    : null;

  return (
    <>
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

        {/* Outer glow */}
        <mesh>
          <sphereGeometry args={[0.55, 24, 24]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} side={THREE.BackSide} />
        </mesh>

        {/* Pulse ring on ground */}
        <mesh ref={pulseRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, 0]}>
          <ringGeometry args={[0.4, 0.9, 32]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>

        {/* GPS accuracy disc — translucent fill + bright edge */}
        {ringR !== null && (
          <group position={[0, -0.98, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[ringR, 64]} />
              <meshBasicMaterial color="#3b82f6" transparent opacity={0.08} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <ringGeometry args={[Math.max(0.01, ringR - 0.1), ringR, 96]} />
              <meshBasicMaterial color="#60a5fa" transparent opacity={0.55} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}

        {/* Heading arrow — a cone oriented along +Z, rotated by yaw */}
        {heading != null && Number.isFinite(heading) && (
          <group ref={headingRef} position={[0, 0.2, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.9]}>
              <coneGeometry args={[0.22, 0.7, 16]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
            </mesh>
          </group>
        )}
      </group>

      {/* Breadcrumb trail — rendered in world space so it doesn't chase the sphere */}
      <Trail3D points={trail} />
    </>
  );
}

function Trail3D({ points }: { points: Array<[number, number]> }) {
  if (points.length < 2) return null;
  const n = points.length;
  return (
    <group>
      {points.map(([px, py], i) => {
        const t = (i + 1) / n;
        const r = 0.12 + t * 0.1;
        return (
          <mesh key={i} position={[px, 0.06, py]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[r, 16]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={t * 0.7} />
          </mesh>
        );
      })}
    </group>
  );
}
