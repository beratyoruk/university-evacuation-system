import { useEffect, useState } from "react";
import type { RouteData } from "../../components/FloorViewer/FloorViewer";
import type { ExitMarker } from "../../components/FloorViewer/FloorViewer";

interface EmergencyAlertProps {
  exit: ExitMarker | null;
  route: RouteData | null;
  /** Distance to the exit in meters */
  distance: number | null;
  direction?: string;
  /** Called when the user dismisses the full-screen alert */
  onAcknowledge: () => void;
}

/**
 * Compute a Turkish cardinal direction label from the first route segment.
 */
function computeDirection(route: RouteData | null): string {
  if (!route || route.coordinates.length < 2) return "";
  const [a, b] = route.coordinates;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  // In building coords: +x = east, +y = south (screen-down) — but label by direction
  if (angle >= -22.5 && angle < 22.5) return "Doğu";
  if (angle >= 22.5 && angle < 67.5) return "Güneydoğu";
  if (angle >= 67.5 && angle < 112.5) return "Güney";
  if (angle >= 112.5 && angle < 157.5) return "Güneybatı";
  if (angle >= 157.5 || angle < -157.5) return "Batı";
  if (angle >= -157.5 && angle < -112.5) return "Kuzeybatı";
  if (angle >= -112.5 && angle < -67.5) return "Kuzey";
  return "Kuzeydoğu";
}

/**
 * EmergencyAlert - Full-screen high-contrast warning overlay shown when
 * emergency mode activates. Includes device vibration, screen-reader live
 * region, and one-tap acknowledgement.
 */
export default function EmergencyAlert({
  exit,
  route,
  distance,
  direction,
  onAcknowledge,
}: EmergencyAlertProps) {
  const [pulse, setPulse] = useState(true);

  // Vibrate on mount (Android / supported devices only)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    try {
      navigator.vibrate([300, 150, 300, 150, 600]);
      const interval = setInterval(() => {
        navigator.vibrate([200, 100, 200]);
      }, 3000);
      return () => {
        clearInterval(interval);
        navigator.vibrate(0);
      };
    } catch {
      // Vibration can be blocked by user settings — ignore
    }
  }, []);

  // Pulse on/off for the background animation
  useEffect(() => {
    const interval = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(interval);
  }, []);

  const dirLabel = direction ?? computeDirection(route);

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby="emergency-title"
      aria-describedby="emergency-desc"
      className={`
        fixed inset-0 z-[200] flex flex-col items-center justify-between
        p-6 sm:p-10 transition-colors duration-500
        ${pulse
          ? "bg-gradient-to-br from-red-700 to-red-900"
          : "bg-gradient-to-br from-red-800 to-red-950"}
      `}
      style={{
        backgroundImage: pulse
          ? "repeating-linear-gradient(45deg, rgba(250,204,21,0.08) 0, rgba(250,204,21,0.08) 20px, transparent 20px, transparent 40px)"
          : undefined,
      }}
    >
      {/* Top: warning header */}
      <div className="flex w-full flex-col items-center text-center">
        <div
          aria-hidden="true"
          className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-400 shadow-2xl"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#7f1d1d" strokeWidth={3} className="h-12 w-12">
            <path d="M12 2L1 21h22L12 2z" />
            <line x1="12" y1="9" x2="12" y2="14" />
            <circle cx="12" cy="18" r="1.2" fill="#7f1d1d" />
          </svg>
        </div>
        <h1
          id="emergency-title"
          className="text-4xl font-black uppercase tracking-wider text-yellow-300 sm:text-5xl"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}
        >
          Acil Tahliye
        </h1>
        <p className="mt-2 text-lg font-medium text-yellow-100 sm:text-xl">
          Binayı derhal güvenli bir şekilde terk edin
        </p>
      </div>

      {/* Middle: exit info */}
      {exit && (
        <div
          id="emergency-desc"
          className="flex w-full max-w-2xl flex-col items-center rounded-2xl border-4 border-yellow-400 bg-black/40 p-6 backdrop-blur-md sm:p-8"
        >
          <div className="text-sm font-bold uppercase tracking-wider text-yellow-300">
            En Yakın Çıkış
          </div>
          <div className="mt-2 break-words text-center text-4xl font-black text-white sm:text-5xl">
            {exit.name}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-4 text-white">
            {distance !== null && (
              <div className="rounded-xl bg-yellow-400 px-5 py-3 text-red-900">
                <div className="text-[10px] font-bold uppercase tracking-wider">Mesafe</div>
                <div className="text-2xl font-black tabular-nums">
                  {Math.round(distance)} m
                </div>
              </div>
            )}
            {dirLabel && (
              <div className="rounded-xl bg-yellow-400 px-5 py-3 text-red-900">
                <div className="text-[10px] font-bold uppercase tracking-wider">Yön</div>
                <div className="text-2xl font-black">{dirLabel}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom: acknowledge button */}
      <button
        onClick={onAcknowledge}
        aria-label="Uyarıyı anladım, yönlendirmeyi başlat"
        className="
          group relative min-h-[64px] w-full max-w-md overflow-hidden rounded-2xl
          bg-yellow-400 px-8 py-5 text-xl font-black uppercase tracking-wider
          text-red-900 shadow-2xl transition hover:bg-yellow-300
          focus:outline-none focus:ring-4 focus:ring-yellow-200
        "
      >
        Anladım — Yönlendirmeye Başla
      </button>
    </div>
  );
}
