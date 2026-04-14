interface ExitCardProps {
  name: string;
  type: "door" | "staircase" | "elevator" | "emergency";
  distance?: number;
  estimatedSeconds?: number;
  direction?: string;
  urgent?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  emergency: "Acil Çıkış",
  door: "Kapı",
  staircase: "Merdiven",
  elevator: "Asansör",
};

const TYPE_ICONS: Record<string, JSX.Element> = {
  emergency: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  door: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <path d="M4 4v16M20 4v16M4 4h16M4 20h16" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  staircase: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <path d="M4 20h4v-4h4v-4h4V8h4V4" />
    </svg>
  ),
  elevator: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 8l3-3 3 3M9 16l3 3 3-3" />
    </svg>
  ),
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `~${Math.round(seconds)} sn`;
  const minutes = Math.round(seconds / 60);
  return `~${minutes} dk`;
}

/**
 * ExitCard - Summary card for a target exit point.
 * Shows name, type, distance, ETA, and direction.
 */
export default function ExitCard({
  name,
  type,
  distance,
  estimatedSeconds,
  direction,
  urgent = false,
}: ExitCardProps) {
  return (
    <div
      role="region"
      aria-label={`Hedef çıkış: ${name}`}
      className={`
        rounded-2xl border p-4 transition
        ${urgent
          ? "border-red-500/50 bg-gradient-to-br from-red-950/60 to-red-900/30"
          : "border-gray-700 bg-gray-800/60"}
      `}
    >
      <div className="mb-3 flex items-start gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            urgent ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
          }`}
          aria-hidden="true"
        >
          {TYPE_ICONS[type]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            {urgent ? "En Yakın Acil Çıkış" : "Hedef Çıkış"}
          </div>
          <div className="truncate text-lg font-bold text-white">{name}</div>
          <div className="text-xs text-gray-400">{TYPE_LABELS[type]}</div>
        </div>
      </div>

      {(distance !== undefined || estimatedSeconds !== undefined) && (
        <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-3">
          {distance !== undefined && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Mesafe</div>
              <div className="text-base font-bold tabular-nums text-white">
                ~{Math.round(distance)} m
              </div>
            </div>
          )}
          {estimatedSeconds !== undefined && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Süre</div>
              <div className="text-base font-bold tabular-nums text-white">
                {formatTime(estimatedSeconds)}
              </div>
            </div>
          )}
        </div>
      )}

      {direction && (
        <div className="mt-3 rounded-lg bg-black/20 px-3 py-2 text-sm text-gray-300">
          <span className="text-xs text-gray-500">Yön: </span>
          {direction}
        </div>
      )}
    </div>
  );
}
