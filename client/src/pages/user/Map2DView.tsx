import { useEffect, useMemo, useRef, useState } from "react";
import type { PlanJSON, RouteData, UserPosition } from "../../components/FloorViewer/FloorViewer";
import { computePlanBounds } from "../../utils/planBounds";

interface Map2DViewProps {
  planData: PlanJSON | null;
  route: RouteData | null;
  userPosition: UserPosition | null;
  width: number;
  height: number;
  emergencyMode: boolean;
  /** GPS accuracy in meters — drawn as a translucent ring around the user */
  accuracy?: number | null;
  /** Compass heading 0..360 (0 = north), drives direction arrow */
  heading?: number | null;
}

const TRAIL_MAX = 24;
const TRAIL_MIN_STEP_M = 0.5;

const PAD = 2;

export default function Map2DView({
  planData,
  route,
  userPosition,
  width,
  height,
  emergencyMode,
  accuracy = null,
  heading = null,
}: Map2DViewProps) {
  const bounds = useMemo(() => {
    if (planData) {
      const b = computePlanBounds(planData);
      if (b.width > 0 && b.height > 0) return b;
    }
    return { minX: 0, minY: 0, maxX: width, maxY: height, width, height };
  }, [planData, width, height]);

  // Recent position breadcrumb — short, fading trail showing where the user just was.
  const [trail, setTrail] = useState<Array<{ x: number; y: number }>>([]);
  const lastPushRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!userPosition) return;
    const last = lastPushRef.current;
    if (last && Math.hypot(last.x - userPosition.x, last.y - userPosition.y) < TRAIL_MIN_STEP_M) {
      return;
    }
    lastPushRef.current = { x: userPosition.x, y: userPosition.y };
    setTrail((prev) => {
      const next = [...prev, { x: userPosition.x, y: userPosition.y }];
      if (next.length > TRAIL_MAX) next.shift();
      return next;
    });
  }, [userPosition]);

  const viewBox = `${bounds.minX - PAD} ${bounds.minY - PAD} ${bounds.width + PAD * 2} ${bounds.height + PAD * 2}`;

  const bgColor = emergencyMode ? "#1a0a0a" : "#0f172a";

  return (
    <div className="h-full w-full bg-gray-950" role="img" aria-label="2D harita görünümü">
      <svg
        className="h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ background: bgColor }}
      >
        <GridLines bounds={bounds} />

        {planData?.rooms?.map((room) => (
          <Room2D key={room.id} room={room} />
        ))}

        {planData?.walls?.map((wall, i) => (
          <line
            key={i}
            x1={wall.x1}
            y1={wall.y1}
            x2={wall.x2}
            y2={wall.y2}
            stroke="#e5e7eb"
            strokeWidth={0.25}
            strokeLinecap="round"
          />
        ))}

        {route && route.coordinates.length >= 2 && (
          <polyline
            points={route.coordinates.map((c) => `${c.x},${c.y}`).join(" ")}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={0.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1.2,0.6"
          />
        )}

        {planData?.exits?.map((exit) => (
          <Exit2D key={exit.id} exit={exit} />
        ))}

        {userPosition && (
          <>
            <Trail2D points={trail} />
            <User2D
              x={userPosition.x}
              y={userPosition.y}
              accuracy={accuracy}
              heading={heading}
            />
          </>
        )}
      </svg>
    </div>
  );
}

function GridLines({ bounds }: { bounds: { minX: number; minY: number; width: number; height: number } }) {
  const step = 5;
  const lines = [];
  const startX = Math.floor(bounds.minX / step) * step;
  const startY = Math.floor(bounds.minY / step) * step;
  const endX = bounds.minX + bounds.width;
  const endY = bounds.minY + bounds.height;

  for (let x = startX; x <= endX; x += step) {
    lines.push(
      <line key={`v${x}`} x1={x} y1={bounds.minY} x2={x} y2={endY} stroke="#1e3a5f" strokeWidth={0.05} />
    );
  }
  for (let y = startY; y <= endY; y += step) {
    lines.push(
      <line key={`h${y}`} x1={bounds.minX} y1={y} x2={endX} y2={y} stroke="#1e3a5f" strokeWidth={0.05} />
    );
  }
  return <g opacity={0.4}>{lines}</g>;
}

function Room2D({ room }: { room: { polygon: Array<{ x: number; y: number }>; name: string } }) {
  if (room.polygon.length < 3) return null;
  const points = room.polygon.map((p) => `${p.x},${p.y}`).join(" ");
  const cx = room.polygon.reduce((s, p) => s + p.x, 0) / room.polygon.length;
  const cy = room.polygon.reduce((s, p) => s + p.y, 0) / room.polygon.length;

  return (
    <g>
      <polygon points={points} fill="#1e3a8a" fillOpacity={0.25} stroke="#1e3a8a" strokeOpacity={0.5} strokeWidth={0.1} />
      <text
        x={cx}
        y={cy}
        fill="#93c5fd"
        fontSize={0.9}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {room.name}
      </text>
    </g>
  );
}

function Exit2D({ exit }: { exit: { x: number; y: number; name: string; type: string } }) {
  const color = exit.type === "emergency" ? "#22c55e" : "#3b82f6";
  return (
    <g>
      <circle cx={exit.x} cy={exit.y} r={0.8} fill={color} stroke="#000" strokeWidth={0.08} />
      <text
        x={exit.x}
        y={exit.y + 2}
        fill={color}
        fontSize={0.7}
        textAnchor="middle"
        stroke="#000"
        strokeWidth={0.08}
        paintOrder="stroke"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {exit.name}
      </text>
    </g>
  );
}

function User2D({
  x,
  y,
  accuracy,
  heading,
}: {
  x: number;
  y: number;
  accuracy: number | null;
  heading: number | null;
}) {
  // Clamp the accuracy ring so a 200m fix doesn't drown the floor plan.
  const ringR = accuracy != null ? Math.max(1, Math.min(accuracy, 60)) : null;
  return (
    <g>
      {ringR !== null && (
        <circle
          cx={x}
          cy={y}
          r={ringR}
          fill="#3b82f6"
          fillOpacity={0.06}
          stroke="#60a5fa"
          strokeOpacity={0.4}
          strokeWidth={0.1}
          strokeDasharray="0.6,0.4"
        />
      )}
      <circle cx={x} cy={y} r={1.2} fill="#60a5fa" fillOpacity={0.35}>
        <animate attributeName="r" from={1.2} to={2.4} dur="1.3s" repeatCount="indefinite" />
        <animate attributeName="fill-opacity" from={0.5} to={0} dur="1.3s" repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r={0.6} fill="#3b82f6" stroke="#fff" strokeWidth={0.14} />
      {heading != null && Number.isFinite(heading) && (
        <g transform={`translate(${x} ${y}) rotate(${heading})`}>
          {/* Small triangle pointing along current heading. SVG 0deg = up after rotate-from-north. */}
          <polygon
            points="0,-2.2 -0.7,-0.9 0.7,-0.9"
            fill="#fff"
            stroke="#1e3a8a"
            strokeWidth={0.1}
          />
        </g>
      )}
    </g>
  );
}

function Trail2D({ points }: { points: Array<{ x: number; y: number }> }) {
  if (points.length < 2) return null;
  return (
    <g>
      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        const t = (i + 1) / points.length;
        return (
          <line
            key={i}
            x1={p.x}
            y1={p.y}
            x2={next.x}
            y2={next.y}
            stroke="#60a5fa"
            strokeOpacity={t * 0.75}
            strokeWidth={0.25}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}
