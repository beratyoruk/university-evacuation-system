import { memo, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid, Text, Detailed } from "@react-three/drei";
import * as THREE from "three";
import UserMarker from "./UserMarker";
import RouteVisualizer from "./RouteVisualizer";

// ─── Types ───

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Room {
  id: string;
  name: string;
  polygon: Array<{ x: number; y: number }>;
  type: string;
}

export interface ExitMarker {
  id: string;
  name: string;
  x: number;
  y: number;
  type: "door" | "staircase" | "elevator" | "emergency";
}

export interface PlanJSON {
  walls: Wall[];
  rooms: Room[];
  exits: ExitMarker[];
}

export interface RouteData {
  path: string[];
  coordinates: Array<{ x: number; y: number }>;
  exitId: string;
  distance: number;
}

export interface UserPosition {
  x: number;
  y: number;
}

interface FloorViewerProps {
  planData: PlanJSON | null;
  route: RouteData | null;
  userPosition: UserPosition | null;
  emergencyMode: boolean;
  width?: number;
  height?: number;
}

// ─── Constants ───

const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.15;
const ROOM_HEIGHT = 0.1;
const SCALE = 1; // 1 unit = 1 meter

const ROOM_COLORS: Record<string, string> = {
  classroom: "#3b82f6",
  office: "#8b5cf6",
  lab: "#06b6d4",
  corridor: "#374151",
  bathroom: "#6366f1",
  storage: "#78716c",
  default: "#4b5563",
};

// ─── Sub-components ───

/** Single wall segment rendered as a tall thin box. */
function WallMesh({ wall }: { wall: Wall }) {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const cx = (wall.x1 + wall.x2) / 2;
  const cy = (wall.y1 + wall.y2) / 2;

  return (
    <mesh
      position={[cx * SCALE, WALL_HEIGHT / 2, cy * SCALE]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length * SCALE, WALL_HEIGHT, WALL_THICKNESS]} />
      <meshStandardMaterial color="#e5e7eb" roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

/**
 * Batch-render all walls using InstancedMesh for performance.
 * Falls back to individual meshes when count is small.
 */
function Walls({ walls }: { walls: Wall[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { geometry, dummy, count } = useMemo(() => {
    const g = new THREE.BoxGeometry(1, WALL_HEIGHT, WALL_THICKNESS);
    const d = new THREE.Object3D();
    return { geometry: g, dummy: d, count: walls.length };
  }, [walls]);

  useMemo(() => {
    if (!meshRef.current) return;
    walls.forEach((wall, i) => {
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const cx = (wall.x1 + wall.x2) / 2;
      const cy = (wall.y1 + wall.y2) / 2;

      dummy.position.set(cx * SCALE, WALL_HEIGHT / 2, cy * SCALE);
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.set(length * SCALE, 1, 1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [walls, dummy]);

  if (count === 0) return null;

  // For small wall counts, use individual meshes for simplicity
  if (count < 20) {
    return (
      <group>
        {walls.map((wall, i) => (
          <WallMesh key={i} wall={wall} />
        ))}
      </group>
    );
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color="#e5e7eb" roughness={0.8} metalness={0.1} />
    </instancedMesh>
  );
}

/**
 * Room polygon extruded to a thin slab with floating label.
 *
 * Uses drei's <Detailed> for distance-based LOD: near the camera we render
 * the full label (SDF text is expensive); past ~40 units the label is dropped.
 */
const RoomMesh = memo(function RoomMesh({ room }: { room: Room }) {
  const { shape, center } = useMemo(() => {
    const s = new THREE.Shape();
    if (room.polygon.length === 0) return { shape: s, center: { x: 0, y: 0 } };

    s.moveTo(room.polygon[0].x * SCALE, room.polygon[0].y * SCALE);
    for (let i = 1; i < room.polygon.length; i++) {
      s.lineTo(room.polygon[i].x * SCALE, room.polygon[i].y * SCALE);
    }
    s.closePath();

    const cx = room.polygon.reduce((sum, p) => sum + p.x, 0) / room.polygon.length;
    const cy = room.polygon.reduce((sum, p) => sum + p.y, 0) / room.polygon.length;

    return { shape: s, center: { x: cx, y: cy } };
  }, [room.polygon]);

  const color = ROOM_COLORS[room.type] || ROOM_COLORS.default;

  const slab = (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROOM_HEIGHT / 2, 0]} receiveShadow>
      <extrudeGeometry args={[shape, { depth: ROOM_HEIGHT, bevelEnabled: false }]} />
      <meshStandardMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
    </mesh>
  );

  return (
    <Detailed distances={[0, 40]}>
      {/* Near: slab + label */}
      <group>
        {slab}
        <Text
          position={[center.x * SCALE, WALL_HEIGHT + 0.5, center.y * SCALE]}
          fontSize={0.6}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          {room.name}
        </Text>
      </group>
      {/* Far: slab only — drop the SDF text mesh */}
      <group>{slab}</group>
    </Detailed>
  );
});

/** Exit marker: green glowing sphere for emergency exits, blue for normal. */
const ExitMesh = memo(function ExitMesh({
  exit,
  emergencyMode,
}: {
  exit: ExitMarker;
  emergencyMode: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const isEmergency = exit.type === "emergency";
  const baseColor = isEmergency ? "#22c55e" : "#3b82f6";
  const glowIntensity = emergencyMode && isEmergency ? 0.8 : 0.2;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (emergencyMode && isEmergency) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.3;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[exit.x * SCALE, 1.5, exit.y * SCALE]}>
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[0.4, 24, 24]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={glowIntensity}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Exit name */}
      <Text
        position={[0, 1.0, 0]}
        fontSize={0.35}
        color={isEmergency ? "#4ade80" : "#93c5fd"}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {exit.name}
      </Text>

      {/* Glow ring on floor for emergency exits */}
      {isEmergency && emergencyMode && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.45, 0]}>
          <ringGeometry args={[0.5, 1.2, 32]} />
          <meshBasicMaterial
            color="#22c55e"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
});

/** Ground plane with grid overlay. */
function Floor({ width, height }: { width: number; height: number }) {
  return (
    <group>
      {/* Solid floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[width / 2, -0.01, height / 2]}
        receiveShadow
      >
        <planeGeometry args={[width + 4, height + 4]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </mesh>

      {/* Grid */}
      <Grid
        args={[width + 4, height + 4]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#1e3a5f"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#2563eb"
        fadeDistance={80}
        fadeStrength={1}
        followCamera={false}
        position={[width / 2, 0, height / 2]}
      />
    </group>
  );
}

/** Directional + ambient lighting setup. Emergency mode shifts to red tint. */
function Lighting({ emergencyMode }: { emergencyMode: boolean }) {
  return (
    <>
      <ambientLight intensity={emergencyMode ? 0.25 : 0.4} color={emergencyMode ? "#ffcccc" : "#ffffff"} />
      <directionalLight
        position={[20, 30, 20]}
        intensity={emergencyMode ? 0.6 : 0.9}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <pointLight
        position={[0, 10, 0]}
        intensity={0.2}
        color={emergencyMode ? "#ff4444" : "#ffffff"}
      />
    </>
  );
}

// ─── Main Component ───

/**
 * FloorViewer - Main 3D floor plan viewer component.
 *
 * Renders a building floor plan in 3D using Three.js / React Three Fiber.
 * Supports walls, rooms, exits, user position marker, and evacuation route.
 *
 * @param planData       - Parsed plan_json from the database
 * @param route          - Active evacuation route (from pathfinding service)
 * @param userPosition   - Current user position in floor coordinates
 * @param emergencyMode  - Whether an emergency evacuation is active
 * @param width          - Floor plan width in meters (default 50)
 * @param height         - Floor plan height in meters (default 50)
 */
function FloorViewer({
  planData,
  route,
  userPosition,
  emergencyMode,
  width = 50,
  height = 50,
}: FloorViewerProps) {
  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
      >
        <PerspectiveCamera
          makeDefault
          position={[width / 2, Math.max(width, height) * 0.6, height + 15]}
          fov={50}
          near={0.1}
          far={500}
        />
        <OrbitControls
          target={[width / 2, 0, height / 2]}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={5}
          maxDistance={Math.max(width, height) * 2}
          enableDamping
          dampingFactor={0.08}
        />

        <Lighting emergencyMode={emergencyMode} />
        <Floor width={width} height={height} />

        {/* Walls */}
        {planData?.walls && <Walls walls={planData.walls} />}

        {/* Rooms */}
        {planData?.rooms?.map((room) => (
          <RoomMesh key={room.id} room={room} />
        ))}

        {/* Exits */}
        {planData?.exits?.map((exit) => (
          <ExitMesh key={exit.id} exit={exit} emergencyMode={emergencyMode} />
        ))}

        {/* User position marker */}
        {userPosition && (
          <UserMarker x={userPosition.x} y={userPosition.y} />
        )}

        {/* Evacuation route */}
        {route && emergencyMode && (
          <RouteVisualizer coordinates={route.coordinates} />
        )}

        {/* Fog for depth perception */}
        <fog attach="fog" args={["#0a0a1a", 60, 150]} />
      </Canvas>
    </div>
  );
}

export default memo(FloorViewer);
