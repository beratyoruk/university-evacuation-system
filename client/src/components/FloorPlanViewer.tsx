import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, PerspectiveCamera, Text } from "@react-three/drei";
import * as THREE from "three";

interface FloorPlanNode {
  id: string;
  x: number;
  y: number;
  z: number;
  type: string;
  label: string;
}

interface EvacuationRoute {
  path: { x: number; y: number; z: number; order: number }[];
  isBlocked: boolean;
}

interface FloorPlanViewerProps {
  nodes: FloorPlanNode[];
  routes: EvacuationRoute[];
  isEmergency: boolean;
  width: number;
  height: number;
}

const NODE_COLORS: Record<string, string> = {
  room: "#3b82f6",
  corridor: "#6b7280",
  exit: "#22c55e",
  stairs: "#f59e0b",
  elevator: "#8b5cf6",
  door: "#06b6d4",
};

function FloorNode({ node, isEmergency }: { node: FloorPlanNode; isEmergency: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = NODE_COLORS[node.type] || "#6b7280";
  const isExit = node.type === "exit";
  const scale = isExit && isEmergency ? 1.5 : 1;

  return (
    <group position={[node.x, node.z, node.y]}>
      <mesh ref={meshRef} scale={scale}>
        {node.type === "room" ? (
          <boxGeometry args={[2, 1, 2]} />
        ) : (
          <sphereGeometry args={[0.4, 16, 16]} />
        )}
        <meshStandardMaterial
          color={isExit && isEmergency ? "#00ff00" : color}
          emissive={isExit && isEmergency ? "#00ff00" : "#000000"}
          emissiveIntensity={isExit && isEmergency ? 0.5 : 0}
          transparent
          opacity={0.85}
        />
      </mesh>
      <Text
        position={[0, 1.2, 0]}
        fontSize={0.35}
        color="white"
        anchorX="center"
        anchorY="bottom"
      >
        {node.label || node.type}
      </Text>
    </group>
  );
}

function EvacRoute({ route }: { route: EvacuationRoute }) {
  if (route.isBlocked || route.path.length < 2) return null;

  const sorted = [...route.path].sort((a, b) => a.order - b.order);
  const points = sorted.map((p) => new THREE.Vector3(p.x, p.z + 0.1, p.y));
  const curve = new THREE.CatmullRomCurve3(points);
  const curvePoints = curve.getPoints(50);
  const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial attach="material" color="#00ff00" linewidth={3} />
    </line>
  );
}

function FloorGrid({ width, height }: { width: number; height: number }) {
  return (
    <Grid
      args={[width, height]}
      cellSize={1}
      cellThickness={0.5}
      cellColor="#1e3a5f"
      sectionSize={5}
      sectionThickness={1}
      sectionColor="#2563eb"
      fadeDistance={50}
      fadeStrength={1}
      followCamera={false}
      position={[width / 2, 0, height / 2]}
    />
  );
}

export default function FloorPlanViewer({
  nodes,
  routes,
  isEmergency,
  width,
  height,
}: FloorPlanViewerProps) {
  return (
    <div className="h-full w-full">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[width / 2, 20, height + 10]} fov={50} />
        <OrbitControls
          target={[width / 2, 0, height / 2]}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={5}
          maxDistance={60}
        />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
        <pointLight position={[width / 2, 15, height / 2]} intensity={0.3} />

        {/* Floor plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.01, height / 2]} receiveShadow>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial color="#111827" />
        </mesh>

        {/* Grid */}
        <FloorGrid width={width} height={height} />

        {/* Nodes */}
        {nodes.map((node) => (
          <FloorNode key={node.id} node={node} isEmergency={isEmergency} />
        ))}

        {/* Evacuation Routes */}
        {isEmergency &&
          routes.map((route, i) => <EvacRoute key={i} route={route} />)}
      </Canvas>
    </div>
  );
}
