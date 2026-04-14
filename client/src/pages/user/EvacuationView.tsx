import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import FloorViewer from "../../components/FloorViewer/FloorViewer";
import FloorSelector from "../../components/FloorViewer/FloorSelector";
import Map2DView from "./Map2DView";
import NavigationPanel from "./NavigationPanel";
import EmergencyAlert from "./EmergencyAlert";
import LoadingSpinner from "../../components/UI/LoadingSpinner";
import DistanceBadge from "../../components/UI/DistanceBadge";
import ExitCard from "../../components/UI/ExitCard";
import { toast } from "../../components/UI/Toast";
import { useAppStore } from "../../store/useAppStore";
import { useFloorPlan } from "../../hooks/useFloorPlan";
import { buildingsApi, type Building } from "../../api/buildings.api";
import { floorsApi, type Floor } from "../../api/floors.api";
import { locationService } from "../../services/locationService";
import { routeService } from "../../services/routeService";
import type { ExitMarker, UserPosition } from "../../components/FloorViewer/FloorViewer";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3001";

type ViewMode = "3d" | "2d";
const WALKING_SPEED_MS = 1.4; // meters/sec — used for ETA

/**
 * EvacuationView - the main end-user screen.
 *
 * Renders a full-screen floor plan (3D or 2D), a collapsible info panel
 * showing location, distance to the nearest exit, ETA, and turn-by-turn
 * instructions. Triggers a full-screen EmergencyAlert when evacuation
 * mode is active.
 */
export default function EvacuationView() {
  const [searchParams] = useSearchParams();
  const buildingParam = searchParams.get("building");
  const floorParam = searchParams.get("floor");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [building, setBuilding] = useState<Building | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [panelOpen, setPanelOpen] = useState(true);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const currentFloor = useAppStore((s) => s.currentFloor);
  const setCurrentFloor = useAppStore((s) => s.setCurrentFloor);
  const setCurrentBuilding = useAppStore((s) => s.setCurrentBuilding);
  const setAppFloors = useAppStore((s) => s.setFloors);
  const userLocation = useAppStore((s) => s.userLocation);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const emergencyMode = useAppStore((s) => s.emergencyMode);
  const setEmergencyMode = useAppStore((s) => s.setEmergencyMode);
  const evacuationRoute = useAppStore((s) => s.evacuationRoute);
  const setEvacuationRoute = useAppStore((s) => s.setEvacuationRoute);

  const { planData, loading: planLoading } = useFloorPlan(currentFloor?.id ?? null);

  // Fetch buildings list once
  useEffect(() => {
    buildingsApi.list()
      .then((res) => setBuildings(res.data.data || []))
      .catch(() => toast("Binalar yüklenemedi", "error"));
  }, []);

  // Select building from URL param or default to first
  useEffect(() => {
    if (buildings.length === 0) return;
    const target = buildingParam
      ? buildings.find((b) => b.id === buildingParam) ?? buildings[0]
      : buildings[0];
    if (target && target.id !== building?.id) {
      setBuilding(target);
      setCurrentBuilding({
        id: target.id,
        name: target.name,
        address: target.address,
        latitude: target.latitude,
        longitude: target.longitude,
        totalFloors: target.totalFloors,
      });
    }
  }, [buildings, buildingParam, building?.id, setCurrentBuilding]);

  // Load floors whenever building changes
  useEffect(() => {
    if (!building) return;
    floorsApi.listByBuilding(building.id)
      .then((res) => {
        const list = res.data.data || [];
        setFloors(list);
        setAppFloors(
          list.map((f) => ({
            id: f.id,
            buildingId: f.buildingId,
            floorNumber: f.floorNumber,
            name: f.name,
            width: f.width,
            height: f.height,
          }))
        );

        // Select floor from URL param or first available
        const target = floorParam
          ? list.find((f) => f.id === floorParam) ?? list[0]
          : list[0];
        if (target) setCurrentFloor(target);
      })
      .catch(() => toast("Katlar yüklenemedi", "error"));
  }, [building, floorParam, setAppFloors, setCurrentFloor]);

  // Start/stop location tracking when building+floor available
  useEffect(() => {
    if (!building || !currentFloor) return;

    locationService.start(
      { latitude: building.latitude, longitude: building.longitude, rotation: 0 },
      currentFloor.id
    );

    const unsub = locationService.onUpdate((sample) => {
      setUserLocation({
        x: sample.x,
        y: sample.y,
        floorId: sample.floorId,
        accuracy: sample.accuracy,
        timestamp: sample.timestamp,
      });
    });

    toast("Konum tespit ediliyor…", "info", 1500);

    return () => {
      unsub();
      locationService.stop();
    };
  }, [building, currentFloor, setUserLocation]);

  // Route recalculation subscription
  useEffect(() => {
    const unsubRoute = routeService.onRoute((route) => {
      setEvacuationRoute(route);
      if (route) toast("Rota güncellendi", "success", 1500);
    });
    const unsubArrival = routeService.onArrival(() => {
      toast("Çıkışa ulaştınız", "success", 5000);
      if ("vibrate" in navigator) navigator.vibrate([100, 50, 100, 50, 200]);
    });
    return () => { unsubRoute(); unsubArrival(); };
  }, [setEvacuationRoute]);

  // Push location updates into routeService for debounced fetching
  useEffect(() => {
    if (!emergencyMode || !userLocation || !building) {
      routeService.clear();
      return;
    }
    routeService.updateLocation({
      buildingId: building.id,
      floorId: userLocation.floorId,
      startX: userLocation.x,
      startY: userLocation.y,
    });
  }, [emergencyMode, userLocation, building]);

  // WebSocket emergency events
  useEffect(() => {
    const token = localStorage.getItem("token");
    const socket = io(WS_URL, { transports: ["websocket", "polling"], auth: { token } });

    socket.on("emergency:start", () => {
      setEmergencyMode(true);
      setAlertDismissed(false);
      toast("Acil durum başladı — yönlendirme aktif", "error", 5000);
    });
    socket.on("emergency:end", () => {
      setEmergencyMode(false);
      routeService.clear();
      toast("Acil durum sona erdi", "success", 3000);
    });

    return () => { socket.disconnect(); };
  }, [setEmergencyMode]);

  // Derived state
  const userPos: UserPosition | null = userLocation && currentFloor && userLocation.floorId === currentFloor.id
    ? { x: userLocation.x, y: userLocation.y }
    : null;

  const nearestExit = useMemo<ExitMarker | null>(() => {
    if (!planData || !userPos || planData.exits.length === 0) return null;
    if (evacuationRoute?.exitId) {
      const matched = planData.exits.find((e) => e.id === evacuationRoute.exitId);
      if (matched) return matched;
    }
    let best: ExitMarker | null = null;
    let bestDist = Infinity;
    for (const exit of planData.exits) {
      const d = Math.hypot(exit.x - userPos.x, exit.y - userPos.y);
      if (d < bestDist) { bestDist = d; best = exit; }
    }
    return best;
  }, [planData, userPos, evacuationRoute]);

  const distanceToExit = useMemo<number | null>(() => {
    if (evacuationRoute?.distance) return evacuationRoute.distance;
    if (!nearestExit || !userPos) return null;
    return Math.hypot(nearestExit.x - userPos.x, nearestExit.y - userPos.y);
  }, [evacuationRoute, nearestExit, userPos]);

  const etaSeconds = distanceToExit !== null ? distanceToExit / WALKING_SPEED_MS : null;

  const handleTriggerEmergency = () => {
    setEmergencyMode(true);
    setAlertDismissed(false);
    toast("Acil durum modu manuel olarak başlatıldı", "warning", 3000);
  };

  const locationLabel = useMemo(() => {
    if (!currentFloor) return "Konum bilinmiyor";
    return `${currentFloor.name || `${currentFloor.floorNumber}. Kat`}${building ? ` — ${building.name}` : ""}`;
  }, [currentFloor, building]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-gray-950 text-white">
      {/* Emergency alert overlay (shown while undismissed) */}
      {emergencyMode && !alertDismissed && (
        <EmergencyAlert
          exit={nearestExit}
          route={evacuationRoute}
          distance={distanceToExit}
          onAcknowledge={() => setAlertDismissed(true)}
        />
      )}

      {/* Top-left emergency banner */}
      {emergencyMode && alertDismissed && (
        <div
          role="alert"
          className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 shadow-2xl sm:left-6 sm:top-6"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-yellow-300" />
          <span className="text-sm font-black uppercase tracking-wider text-white">
            Acil Tahliye
          </span>
        </div>
      )}

      {/* Header bar */}
      <header className="flex items-center justify-between gap-4 border-b border-gray-800 bg-gray-900/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
            UE
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {building?.name || "Tahliye Yönlendirme"}
            </div>
            <div className="truncate text-[11px] text-gray-400">{locationLabel}</div>
          </div>
        </div>

        {/* 2D/3D toggle */}
        <div
          role="tablist"
          aria-label="Görünüm seçimi"
          className="flex items-center rounded-xl border border-gray-700 bg-gray-800 p-0.5"
        >
          {(["3d", "2d"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              role="tab"
              aria-selected={viewMode === mode}
              onClick={() => setViewMode(mode)}
              className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-semibold transition ${
                viewMode === mode
                  ? "bg-emerald-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {mode === "3d" ? "3D" : "2D"}
            </button>
          ))}
        </div>
      </header>

      {/* Main content area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Floor selector (hidden on very small screens) */}
        {floors.length > 1 && (
          <div className="hidden sm:block">
            <FloorSelector
              floors={floors}
              selectedFloorId={currentFloor?.id ?? null}
              onSelectFloor={(id) => {
                const f = floors.find((x) => x.id === id);
                if (f) setCurrentFloor(f);
              }}
            />
          </div>
        )}

        {/* Viewer */}
        <div className="relative flex-1">
          {planLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/70">
              <LoadingSpinner size="lg" label="Kat planı yükleniyor" />
            </div>
          )}

          {currentFloor && viewMode === "3d" && (
            <FloorViewer
              planData={planData}
              route={evacuationRoute}
              userPosition={userPos}
              emergencyMode={emergencyMode}
              width={currentFloor.width}
              height={currentFloor.height}
            />
          )}
          {currentFloor && viewMode === "2d" && (
            <Map2DView
              planData={planData}
              route={evacuationRoute}
              userPosition={userPos}
              width={currentFloor.width}
              height={currentFloor.height}
              emergencyMode={emergencyMode}
            />
          )}
          {!currentFloor && !planLoading && (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-gray-400">Görüntülenecek kat bulunamadı</p>
            </div>
          )}

          {/* Manual emergency trigger */}
          {!emergencyMode && (
            <button
              onClick={handleTriggerEmergency}
              aria-label="Acil durum başlat"
              className="
                group absolute bottom-24 right-4 z-20 flex min-h-[64px] min-w-[64px]
                items-center justify-center rounded-full bg-red-600 shadow-2xl
                transition hover:bg-red-500 focus:outline-none focus:ring-4 focus:ring-red-500/40
                sm:bottom-6 sm:right-6
              "
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 animate-ping rounded-full bg-red-600 opacity-40"
              />
              <span
                aria-hidden="true"
                className="absolute -inset-2 animate-pulse rounded-full bg-red-500/30"
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                className="relative h-7 w-7 text-white"
              >
                <path d="M12 2L1 21h22L12 2z" />
                <line x1="12" y1="9" x2="12" y2="14" />
                <circle cx="12" cy="18" r="1" fill="currentColor" />
              </svg>
            </button>
          )}
        </div>

        {/* Side panel (collapsible) */}
        <aside
          aria-label="Tahliye bilgileri"
          className={`
            absolute right-0 top-0 z-20 flex h-full flex-col gap-3 overflow-y-auto
            border-l border-gray-800 bg-gray-900/95 p-4 backdrop-blur-md
            transition-all duration-300
            ${panelOpen ? "w-[90vw] max-w-sm translate-x-0" : "w-0 translate-x-full sm:w-12 sm:translate-x-0"}
          `}
        >
          {/* Collapse toggle */}
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            aria-label={panelOpen ? "Paneli kapat" : "Paneli aç"}
            aria-expanded={panelOpen}
            className="absolute -left-10 top-4 flex h-10 w-10 items-center justify-center rounded-l-xl border-y border-l border-gray-800 bg-gray-900/95 text-gray-400 transition hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              {panelOpen ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
            </svg>
          </button>

          {panelOpen && (
            <>
              {/* Location info */}
              <section
                aria-label="Bulunduğunuz konum"
                className="rounded-2xl border border-gray-800 bg-gray-800/60 p-4"
              >
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  Konumunuz
                </div>
                <div className="mt-1 text-lg font-bold text-white">{locationLabel}</div>
                {userPos ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    GPS sinyali alındı
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Konum bekleniyor
                  </div>
                )}
              </section>

              {/* Distance + ETA */}
              {(distanceToExit !== null || etaSeconds !== null) && (
                <div className="grid grid-cols-2 gap-2">
                  {distanceToExit !== null && (
                    <DistanceBadge
                      meters={distanceToExit}
                      urgent={emergencyMode}
                      label="Çıkışa Mesafe"
                    />
                  )}
                  {etaSeconds !== null && (
                    <div
                      className={`flex flex-col items-center rounded-xl border px-4 py-2 ${
                        emergencyMode
                          ? "border-red-500/40 bg-red-900/30"
                          : "border-gray-700 bg-gray-800/60"
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">
                        Tahmini Süre
                      </span>
                      <span
                        className={`font-bold tabular-nums ${
                          emergencyMode ? "text-red-300 text-2xl" : "text-white text-xl"
                        }`}
                      >
                        {etaSeconds < 60
                          ? `~${Math.round(etaSeconds)} sn`
                          : `~${Math.round(etaSeconds / 60)} dk`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Nearest exit */}
              {nearestExit && (
                <ExitCard
                  name={nearestExit.name}
                  type={nearestExit.type}
                  distance={distanceToExit ?? undefined}
                  estimatedSeconds={etaSeconds ?? undefined}
                  urgent={emergencyMode}
                />
              )}

              {/* Navigation steps */}
              <NavigationPanel
                route={evacuationRoute}
                userPosition={userPos}
                voiceEnabled={emergencyMode}
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
