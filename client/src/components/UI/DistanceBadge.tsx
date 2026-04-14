import { useEffect, useRef, useState } from "react";

interface DistanceBadgeProps {
  /** Distance in meters */
  meters: number;
  /** Urgent styling (e.g. for emergency evacuation) */
  urgent?: boolean;
  label?: string;
}

/**
 * DistanceBadge - Animated counter that smoothly interpolates to the target distance.
 * Shows meters for <1km, otherwise kilometers with one decimal.
 */
export default function DistanceBadge({
  meters,
  urgent = false,
  label = "Mesafe",
}: DistanceBadgeProps) {
  const [displayed, setDisplayed] = useState(meters);
  const frameRef = useRef<number>();
  const startRef = useRef<number>();
  const fromRef = useRef<number>(meters);

  useEffect(() => {
    fromRef.current = displayed;
    startRef.current = undefined;

    const animate = (timestamp: number) => {
      if (startRef.current === undefined) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const duration = 600;
      const t = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const value = fromRef.current + (meters - fromRef.current) * eased;
      setDisplayed(value);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meters]);

  const formatted =
    displayed >= 1000
      ? `${(displayed / 1000).toFixed(1)} km`
      : `${Math.round(displayed)} m`;

  return (
    <div
      role="status"
      aria-label={`${label}: ${formatted}`}
      className={`
        inline-flex flex-col items-center rounded-xl border px-4 py-2
        ${urgent
          ? "border-red-500/40 bg-red-900/30"
          : "border-gray-700 bg-gray-800/60"}
      `}
    >
      <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      <span
        className={`font-bold tabular-nums ${
          urgent ? "text-red-300 text-2xl" : "text-white text-xl"
        }`}
      >
        {formatted}
      </span>
    </div>
  );
}
