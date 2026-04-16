import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, Text } from "@react-three/drei";
import * as THREE from "three";
import type { PlanJSON, RouteData, UserPosition } from "../../components/FloorViewer/FloorViewer";

interface Map2DViewProps {
  planData: PlanJSON | null;
  route: RouteData | null;
  userPosition: UserPosition | null;
  width: number;
  height: number;
  emergencyMode: boolean;
}

/**
 * Map2DView - Top-down orthographic alternative to the 3D FloorViewer.
 *
 * Renders walls as thin lines, rooms as filled polygons, exits as green
 * chevron markers, the user as a pulsing blue dot, and the route as a
 * yellow polyline.
 */
export default function Map2DView({
  planData,
  route,
  userPosition,
  width,
  height,
  emergencyMode,
}: Map2DViewProps) {
  const cameraSize = Math.max(width, height) * 0.6;

  return (
    <div className="h-full w-full bg-gray-950" role="img" aria-label="2D harita görünümü">
      <Canvas orthographic dpr={[1, 2]}>
        <OrthographicCamera
          makeDefault
          position={[width / 2, 50, height / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          zoom={1}
          left={-cameraSize}
          right={cameraSize}
          top={cameraSize}
          bottom={-cameraSize}
          near={0.1}
          far={200}
        />

        <ambientLight intensity={1} />

        {/* Floor background */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, height / 2]}>
          <planeGeometry args={[width + 4, height + 4]} />
          <meshBasicMaterial color={emergencyMode ? "#1a0a0a" : "#0f172a"} />
        </mesh>

        {/* Grid lines */}
        <GridLines width={width} height={height} />

        {/* Rooms */}
        {planData?.rooms?.map((room) => (
          <Room2D key={room.id} room={room} />
        ))}

        {/* Walls */}
        {planData?.walls?.map((wall, i) => (
          <Wall2D key={i} wall={wall} />
        ))}

        {/* Route */}
        {route && route.coordinates.length >= 2 && (
          <Route2D coordinates={route.coordinates} />
        )}

        {/* Exits */}
        {planData?.exits?.map((exit) => (
          <Exit2D key={exit.id} exit={exit} />
        ))}

        {/* User position */}
        {userPosition && <User2D x={userPosition.x} y={userPosition.y} />}
      </Canvas>
    </div>
  );
}

function GridLines({ width, height }: { width: number; height: number }) {
  const lines = useMemo(() => {
    const pts: number[] = [];
    const step = 5;
    for (let x = 0; x <= width; x += step) {
      pts.push(x, 0.01, 0, x, 0.01, height);
    }
    for (let z = 0; z <= height; z += step) {
      pts.push(0, 0.01, z, width, 0.01, z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [width, height]);

  return (
    <lineSegments>
      <primitive object={lines} attach="geometry" />
      <lineBasicMaterial color="#1e3a5f" transparent opacity={0.3} />
    </lineSegments>
  );
}

function Wall2D({ wall }: { wall: { x1: number; y1: number; x2: number; y2: number } }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([wall.x1, 0.1, wall.y1, wall.x2, 0.1, wall.y2], 3)
    );
    return geo;
  }, [wall]);

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#e5e7eb" linewidth={2} />
    </line>
  );
}

function Room2D({ room }: { room: { polygon: Array<{ x: number; y: number }>; name: string } }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    if (room.polygon.length === 0) return s;
    s.moveTo(room.polygon[0].x, room.polygon[0].y);
    for (let i = 1; i < room.polygon.length; i++) {
      s.lineTo(room.polygon[i].x, room.polygon[i].y);
    }
    s.closePath();
    return s;
  }, [room.polygon]);

  const cx = room.polygon.reduce((s, p) => s + p.x, 0) / Math.max(room.polygon.length, 1);
  const cy = room.polygon.reduce((s, p) => s + p.y, 0) / Math.max(room.polygon.length, 1);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color="#1e3a8a" transparent opacity={0.25} />
      </mesh>
      <Text
        position={[cx, 0.2, cy]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.8}
        color="#93c5fd"
        anchorX="center"
        anchorY="middle"
      >
        {room.name}
      </Text>
    </group>
  );
}

function Exit2D({ exit }: { exit: { x: number; y: number; name: string; type: string } }) {
  const color = exit.type === "emergency" ? "#22c55e" : "#3b82f6";
  return (
    <group position={[exit.x, 0.3, exit.y]}>
      {/* Chevron / arrow pointing up */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 3]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Text
        position={[0, 0.1, 1.8]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.7}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {exit.name}
      </Text>
    </group>
  );
}

function Route2D({ coordinates }: { coordinates: Array<{ x: number; y: number }> }) {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    coordinates.forEach((c) => pts.push(c.x, 0.2, c.y));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [coordinates]);

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#fbbf24" linewidth={4} />
    </line>
  );
}

function User2D({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, 0.4, y]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 24]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.8, 1.3, 24]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}
