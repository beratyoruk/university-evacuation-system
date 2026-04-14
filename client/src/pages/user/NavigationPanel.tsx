import { useEffect, useMemo, useRef, useState } from "react";
import type { RouteData, UserPosition } from "../../components/FloorViewer/FloorViewer";

interface NavigationPanelProps {
  route: RouteData | null;
  userPosition: UserPosition | null;
  voiceEnabled?: boolean;
}

interface Step {
  index: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  distance: number;
  turn: "straight" | "left" | "right" | "slight-left" | "slight-right" | "arrive";
  instruction: string;
}

const COMPLETION_THRESHOLD = 3; // meters — advance to next step

/**
 * Compute turn direction from three sequential points.
 * Returns the turn type relative to the previous heading.
 */
function classifyTurn(
  prev: { x: number; y: number },
  current: { x: number; y: number },
  next: { x: number; y: number }
): Step["turn"] {
  const v1x = current.x - prev.x;
  const v1y = current.y - prev.y;
  const v2x = next.x - current.x;
  const v2y = next.y - current.y;

  // Cross product z-component indicates turn direction
  const cross = v1x * v2y - v1y * v2x;
  // Dot product tells us if it's forward or backward
  const dot = v1x * v2x + v1y * v2y;
  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);
  if (len1 === 0 || len2 === 0) return "straight";

  const angle = Math.atan2(Math.abs(cross), dot) * (180 / Math.PI);

  if (angle < 20) return "straight";
  if (angle < 60) return cross > 0 ? "slight-left" : "slight-right";
  return cross > 0 ? "left" : "right";
}

function buildSteps(coordinates: Array<{ x: number; y: number }>): Step[] {
  if (coordinates.length < 2) return [];

  const steps: Step[] = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const from = coordinates[i];
    const to = coordinates[i + 1];
    const distance = Math.hypot(to.x - from.x, to.y - from.y);

    let turn: Step["turn"] = "straight";
    if (i === 0) {
      turn = "straight";
    } else {
      turn = classifyTurn(coordinates[i - 1], from, to);
    }

    const isLast = i === coordinates.length - 2;
    if (isLast) turn = "arrive";

    steps.push({
      index: i,
      from,
      to,
      distance,
      turn,
      instruction: buildInstruction(turn, distance, isLast),
    });
  }

  return steps;
}

function buildInstruction(turn: Step["turn"], distance: number, isLast: boolean): string {
  const distStr = distance < 10 ? `${distance.toFixed(0)}m` : `${Math.round(distance)}m`;

  if (isLast) return `Çıkışa ulaşın — ${distStr}`;

  switch (turn) {
    case "straight":
      return `Koridorda düz devam edin — ${distStr}`;
    case "left":
      return `Sola dönün — ${distStr}`;
    case "right":
      return `Sağa dönün — ${distStr}`;
    case "slight-left":
      return `Hafif sola dönün — ${distStr}`;
    case "slight-right":
      return `Hafif sağa dönün — ${distStr}`;
    case "arrive":
      return `Çıkışa ulaşın — ${distStr}`;
  }
}

const TURN_ICONS: Record<Step["turn"], JSX.Element> = {
  straight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  ),
  left: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
      <path d="M5 12h14M11 6l-6 6 6 6" />
    </svg>
  ),
  right: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
      <path d="M19 12H5M13 6l6 6-6 6" />
    </svg>
  ),
  "slight-left": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
      <path d="M17 20L8 11V5M3 8l5-3" />
    </svg>
  ),
  "slight-right": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
      <path d="M7 20l9-9V5M21 8l-5-3" />
    </svg>
  ),
  arrive: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
      <path d="M12 22s8-6 8-13a8 8 0 10-16 0c0 7 8 13 8 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
};

/**
 * Speak an instruction using the Web Speech API in Turkish.
 * No-op if the API or voice is unavailable.
 */
function speakTurkish(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "tr-TR";
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const turkishVoice = voices.find((v) => v.lang.startsWith("tr"));
    if (turkishVoice) utterance.voice = turkishVoice;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("[NavigationPanel] TTS failed:", err);
  }
}

/**
 * NavigationPanel - Turn-by-turn evacuation instructions with voice guidance.
 *
 * Computes directional steps from the route polyline, auto-advances as the
 * user approaches each waypoint, and optionally speaks each step in Turkish
 * using the Web Speech API.
 */
export default function NavigationPanel({
  route,
  userPosition,
  voiceEnabled = true,
}: NavigationPanelProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [voiceOn, setVoiceOn] = useState(voiceEnabled);
  const lastSpokenStep = useRef<number>(-1);

  const steps = useMemo(() => {
    if (!route) return [];
    return buildSteps(route.coordinates);
  }, [route]);

  // Auto-advance step as user approaches waypoint
  useEffect(() => {
    if (!userPosition || steps.length === 0) return;
    const step = steps[currentStep];
    if (!step) return;

    const distToStepEnd = Math.hypot(
      step.to.x - userPosition.x,
      step.to.y - userPosition.y
    );

    if (distToStepEnd < COMPLETION_THRESHOLD && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [userPosition, steps, currentStep]);

  // Reset step when route changes
  useEffect(() => {
    setCurrentStep(0);
    lastSpokenStep.current = -1;
  }, [route?.exitId]);

  // Speak the current step once when it becomes active
  useEffect(() => {
    if (!voiceOn || steps.length === 0) return;
    const step = steps[currentStep];
    if (!step) return;
    if (lastSpokenStep.current === currentStep) return;

    speakTurkish(step.instruction);
    lastSpokenStep.current = currentStep;
  }, [voiceOn, steps, currentStep]);

  if (!route || steps.length === 0) {
    return (
      <div
        aria-label="Yönlendirme paneli"
        className="rounded-2xl border border-gray-700 bg-gray-800/60 p-4"
      >
        <p className="text-sm text-gray-400">
          Rota bekleniyor… Konum tespit edildiğinde yönlendirme başlayacak.
        </p>
      </div>
    );
  }

  const active = steps[currentStep];
  const upcoming = steps.slice(currentStep + 1, currentStep + 3);

  return (
    <div
      role="region"
      aria-label="Adım adım yönlendirme"
      className="flex flex-col gap-3 rounded-2xl border border-gray-700 bg-gray-800/60 p-4"
    >
      {/* Voice toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Yönlendirme
        </span>
        <button
          onClick={() => setVoiceOn(!voiceOn)}
          aria-label={voiceOn ? "Sesli yönlendirmeyi kapat" : "Sesli yönlendirmeyi aç"}
          className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
            voiceOn
              ? "bg-emerald-600/20 text-emerald-400"
              : "bg-gray-800 text-gray-500"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            {voiceOn ? (
              <>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 010 7.07" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
              </>
            ) : (
              <>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M23 9l-6 6M17 9l6 6" />
              </>
            )}
          </svg>
          {voiceOn ? "Sesli" : "Sessiz"}
        </button>
      </div>

      {/* Active step */}
      <div className="flex items-start gap-3 rounded-xl bg-emerald-900/20 p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
          {TURN_ICONS[active.turn]}
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400">
            Şimdi
          </div>
          <p className="text-base font-semibold leading-tight text-white">
            {active.instruction}
          </p>
          <div className="mt-1 text-xs text-gray-500">
            Adım {currentStep + 1} / {steps.length}
          </div>
        </div>
      </div>

      {/* Upcoming steps */}
      {upcoming.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            Sırada
          </div>
          {upcoming.map((step) => (
            <div
              key={step.index}
              className="flex items-center gap-2.5 rounded-lg bg-gray-900/40 px-3 py-2"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-gray-400">
                {TURN_ICONS[step.turn]}
              </div>
              <p className="text-sm text-gray-300">{step.instruction}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
