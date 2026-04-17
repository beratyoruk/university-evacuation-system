import { lazy, Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import NavigationPanel from "./NavigationPanel";
import EmergencyAlert from "./EmergencyAlert";
import LoadingSpinner from "../../components/UI/LoadingSpinner";

const FloorViewer = lazy(() => import("../../components/FloorViewer/FloorViewer"));
const Map2DView = lazy(() => import("./Map2DView"));
import DistanceBadge from "../../components/UI/DistanceBadge";
import ExitCard from "../../components/UI/ExitCard";
import { toast } from "../../components/UI/Toast";
import { useAppStore } from "../../store/useAppStore";
import { useFloorPlan } from "../../hooks/useFloorPlan";
import { useNearestBuilding, type GeoState } from "../../hooks/useNearestBuilding";
import { buildingsApi, type Building } from "../../api/buildings.api";
import { floorsApi, type Floor } from "../../api/floors.api";
import { locationService } from "../../services/locationService";
import { routeService } from "../../services/routeService";
import { floorDetection } from "../../services/floorDetection";
import type { ExitMarker, UserPosition } from "../../components/FloorViewer/FloorViewer";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3001";

type ViewMode = "3d" | "2d";
const WALKING_SPEED_MS = 1.4;

export default function EvacuationView() {
  const [searchParams] = useSearchParams();
  const buildingParam = searchParams.get("building");
  const floorParam = searchParams.get("floor");

  const [manualMode, setManualMode] = useState(false);
  const [allBuildings, setAllBuildings] = useState<Building[]>([]);
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

  const {
    gpsStatus,
    geoState,
    building: nearestBuilding,
    floors: nearestFloors,
    loading: gpsLoading,
    error: gpsError,
    retry: retryGps,
  } = useNearestBuilding();

  // ─── Auto-select building from GPS ───
  useEffect(() => {
    if (buildingParam || manualMode) return;
    if (!nearestBuilding) return;

    setBuilding({
      id: nearestBuilding.id,
      name: nearestBuilding.name,
      address: nearestBuilding.address,
      latitude: nearestBuilding.latitude,
      longitude: nearestBuilding.longitude,
      totalFloors: nearestBuilding.totalFloors,
      createdAt: "",
      updatedAt: "",
    });
    setCurrentBuilding({
      id: nearestBuilding.id,
      name: nearestBuilding.name,
      address: nearestBuilding.address,
      latitude: nearestBuilding.latitude,
      longitude: nearestBuilding.longitude,
      totalFloors: nearestBuilding.totalFloors,
    });

    const floorList: Floor[] = nearestFloors.map((f) => ({
      id: f.id,
      buildingId: f.buildingId,
      floorNumber: f.floorNumber,
      name: f.name,
      planUrl: f.planUrl,
      width: 60,
      height: 30,
      createdAt: "",
      updatedAt: "",
    }));
    setFloors(floorList);
    setAppFloors(
      floorList.map((f) => ({
        id: f.id,
        buildingId: f.buildingId,
        floorNumber: f.floorNumber,
        name: f.name,
        width: f.width,
        height: f.height,
      }))
    );

    const target = floorParam
      ? floorList.find((f) => f.id === floorParam) ?? floorList[0]
      : floorList[0];
    if (target) setCurrentFloor(target);

    toast(`${nearestBuilding.name} tespit edildi (${Math.round(nearestBuilding.distance)}m)`, "success", 3000);
  }, [nearestBuilding, nearestFloors, buildingParam, floorParam, manualMode, setCurrentBuilding, setAppFloors, setCurrentFloor]);

  // ─── Manual building from URL param ───
  useEffect(() => {
    if (!buildingParam) return;
    buildingsApi.get(buildingParam)
      .then((res) => {
        const b = res.data.data;
        if (!b) return;
        setBuilding(b);
        setCurrentBuilding({
          id: b.id,
          name: b.name,
          address: b.address,
          latitude: b.latitude,
          longitude: b.longitude,
          totalFloors: b.totalFloors,
        });
      })
      .catch(() => toast("Bina bulunamadı", "error"));
  }, [buildingParam, setCurrentBuilding]);

  // ─── Load floors when building set via URL param ───
  useEffect(() => {
    if (!building || nearestBuilding?.id === building.id) return;
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
        const target = floorParam
          ? list.find((f) => f.id === floorParam) ?? list[0]
          : list[0];
        if (target) setCurrentFloor(target);
      })
      .catch(() => toast("Katlar yüklenemedi", "error"));
  }, [building, nearestBuilding?.id, floorParam, setAppFloors, setCurrentFloor]);

  // ─── Fetch all buildings for manual fallback ───
  useEffect(() => {
    if (!manualMode && gpsStatus !== "denied" && nearestBuilding) return;
    buildingsApi.list()
      .then((res) => setAllBuildings(res.data.data || []))
      .catch(() => {});
  }, [manualMode, gpsStatus, nearestBuilding]);

  // ─── Floor detection service ───
  useEffect(() => {
    floorDetection.startAutoDetection();
    const unsub = floorDetection.onChange((idx) => {
      const f = floors[idx];
      if (f) setCurrentFloor(f);
    });
    return () => {
      unsub();
      floorDetection.stopAutoDetection();
    };
  }, [floors, setCurrentFloor]);

  // ─── Location tracking ───
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

    return () => {
      unsub();
      locationService.stop();
    };
  }, [building, currentFloor, setUserLocation]);

  // ─── Route subscription ───
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

  // ─── WebSocket ───
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

  // ─── Derived ───
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

  const handleSelectManualBuilding = useCallback(async (b: Building) => {
    setManualMode(true);
    setBuilding(b);
    setCurrentBuilding({
      id: b.id,
      name: b.name,
      address: b.address,
      latitude: b.latitude,
      longitude: b.longitude,
      totalFloors: b.totalFloors,
    });
    try {
      const res = await floorsApi.listByBuilding(b.id);
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
      if (list[0]) setCurrentFloor(list[0]);
    } catch {
      toast("Katlar yüklenemedi", "error");
    }
  }, [setCurrentBuilding, setAppFloors, setCurrentFloor]);

  const handleFloorSelect = useCallback((floorId: string) => {
    const f = floors.find((x) => x.id === floorId);
    if (f) {
      setCurrentFloor(f);
      const idx = floors.indexOf(f);
      floorDetection.setFloor(idx);
    }
  }, [floors, setCurrentFloor]);

  const locationLabel = useMemo(() => {
    if (!currentFloor) return "Konum bilinmiyor";
    return `${currentFloor.name || `${currentFloor.floorNumber}. Kat`}${building ? ` — ${building.name}` : ""}`;
  }, [currentFloor, building]);

  // ─── Loading screen (GPS waiting) ───
  if (!buildingParam && !manualMode && (gpsStatus === "waiting" || (gpsLoading && !nearestBuilding && !gpsError))) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-gray-950 text-white">
        <LoadingSpinner size="lg" label="Konumunuz alınıyor..." />
        <p className="text-sm text-gray-400">GPS sinyali bekleniyor</p>
      </div>
    );
  }

  // ─── No building nearby / GPS denied → manual fallback ───
  if (!buildingParam && !manualMode && !nearestBuilding && !gpsLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-gray-950 px-6 text-white">
        <div className="text-center">
          {gpsStatus === "denied" ? (
            <>
              <h2 className="text-lg font-bold">Konum izni gerekli</h2>
              <p className="mt-2 text-sm text-gray-400">
                Otomatik bina tespiti için tarayıcı konum iznini etkinleştirin.
              </p>
              <button
                onClick={retryGps}
                className="mt-4 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium transition hover:bg-emerald-700"
              >
                Konum iznini tekrar iste
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold">Yakınınızda kayıtlı bina bulunamadı</h2>
              <p className="mt-2 text-sm text-gray-400">
                {geoState
                  ? `Konumunuz: ${geoState.lat.toFixed(4)}, ${geoState.lng.toFixed(4)}`
                  : gpsError || "Konum alınamadı"}
              </p>
            </>
          )}
        </div>

        <div className="w-full max-w-md">
          <h3 className="mb-3 text-sm font-semibold text-gray-300">Manuel bina seçimi</h3>
          {allBuildings.length === 0 ? (
            <LoadingSpinner size="sm" label="Binalar yükleniyor..." />
          ) : (
            <div className="space-y-2">
              {allBuildings.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSelectManualBuilding(b)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-left transition hover:border-emerald-500 hover:bg-gray-700"
                >
                  <div className="font-medium text-white">{b.name}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{b.address}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main UI ───
  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-gray-950 text-white">
      {/* Emergency alert overlay */}
      {emergencyMode && !alertDismissed && (
        <EmergencyAlert
          exit={nearestExit}
          route={evacuationRoute}
          distance={distanceToExit}
          onAcknowledge={() => setAlertDismissed(true)}
        />
      )}

      {/* Emergency banner */}
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

      {/* Header */}
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

      {/* Main content */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Viewer area */}
        <div className="relative flex-1">
          {/* GPS indicator (top-left) */}
          <GpsIndicator geoState={geoState} gpsStatus={gpsStatus} />

          {/* Building name badge (top-right) */}
          {building && (
            <div className="absolute right-3 top-3 z-20 rounded-lg bg-gray-900/80 px-3 py-1.5 text-xs font-medium text-emerald-400 backdrop-blur-sm">
              {building.name}
            </div>
          )}

          {/* Floor selector (bottom) */}
          {floors.length > 1 && (
            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-gray-700 bg-gray-900/90 p-1 backdrop-blur-sm">
              {floors.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFloorSelect(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    currentFloor?.id === f.id
                      ? "bg-emerald-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {f.name || `Kat ${f.floorNumber}`}
                </button>
              ))}
            </div>
          )}

          {/* Accuracy warning */}
          {geoState && geoState.accuracy > 20 && (
            <div className="absolute left-1/2 top-12 z-20 -translate-x-1/2 rounded-lg bg-amber-900/80 px-3 py-1.5 text-xs font-medium text-amber-300 backdrop-blur-sm">
              Konum hassasiyeti düşük ({Math.round(geoState.accuracy)}m)
            </div>
          )}

          {planLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/70">
              <LoadingSpinner size="lg" label="Kat planı yükleniyor" />
            </div>
          )}

          {currentFloor && (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <LoadingSpinner size="lg" label="Görüntüleyici yükleniyor" />
                </div>
              }
            >
              {viewMode === "3d" ? (
                <FloorViewer
                  planData={planData}
                  route={evacuationRoute}
                  userPosition={userPos}
                  emergencyMode={emergencyMode}
                  width={currentFloor.width}
                  height={currentFloor.height}
                />
              ) : (
                <Map2DView
                  planData={planData}
                  route={evacuationRoute}
                  userPosition={userPos}
                  width={currentFloor.width}
                  height={currentFloor.height}
                  emergencyMode={emergencyMode}
                />
              )}
            </Suspense>
          )}
          {!currentFloor && !planLoading && (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-gray-400">Görüntülenecek kat bulunamadı</p>
            </div>
          )}

          {/* Emergency button */}
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
              <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-red-600 opacity-40" />
              <span aria-hidden="true" className="absolute -inset-2 animate-pulse rounded-full bg-red-500/30" />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="relative h-7 w-7 text-white">
                <path d="M12 2L1 21h22L12 2z" />
                <line x1="12" y1="9" x2="12" y2="14" />
                <circle cx="12" cy="18" r="1" fill="currentColor" />
              </svg>
            </button>
          )}
        </div>

        {/* Side panel */}
        <aside
          aria-label="Tahliye bilgileri"
          className={`
            absolute right-0 top-0 z-20 flex h-full flex-col gap-3 overflow-y-auto
            border-l border-gray-800 bg-gray-900/95 p-4 backdrop-blur-md
            transition-all duration-300
            ${panelOpen ? "w-[90vw] max-w-sm translate-x-0" : "w-0 translate-x-full sm:w-12 sm:translate-x-0"}
          `}
        >
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
              <section aria-label="Bulunduğunuz konum" className="rounded-2xl border border-gray-800 bg-gray-800/60 p-4">
                <div className="text-[10px] uppercase tracking-wider text-gray-500">Konumunuz</div>
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

              {(distanceToExit !== null || etaSeconds !== null) && (
                <div className="grid grid-cols-2 gap-2">
                  {distanceToExit !== null && (
                    <DistanceBadge meters={distanceToExit} urgent={emergencyMode} label="Çıkışa Mesafe" />
                  )}
                  {etaSeconds !== null && (
                    <div className={`flex flex-col items-center rounded-xl border px-4 py-2 ${
                      emergencyMode ? "border-red-500/40 bg-red-900/30" : "border-gray-700 bg-gray-800/60"
                    }`}>
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">Tahmini Süre</span>
                      <span className={`font-bold tabular-nums ${emergencyMode ? "text-red-300 text-2xl" : "text-white text-xl"}`}>
                        {etaSeconds < 60
                          ? `~${Math.round(etaSeconds)} sn`
                          : `~${Math.round(etaSeconds / 60)} dk`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {nearestExit && (
                <ExitCard
                  name={nearestExit.name}
                  type={nearestExit.type}
                  distance={distanceToExit ?? undefined}
                  estimatedSeconds={etaSeconds ?? undefined}
                  urgent={emergencyMode}
                />
              )}

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

function GpsIndicator({ geoState, gpsStatus }: { geoState: GeoState | null; gpsStatus: string }) {
  if (!geoState && gpsStatus !== "active") {
    return (
      <div className="absolute left-3 top-3 z-20 rounded-lg bg-gray-900/80 px-3 py-1.5 text-xs text-gray-500 backdrop-blur-sm">
        GPS bekleniyor...
      </div>
    );
  }
  if (!geoState) return null;

  return (
    <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-lg bg-gray-900/80 px-3 py-1.5 backdrop-blur-sm">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      <span className="text-xs tabular-nums text-gray-300">
        {geoState.lat.toFixed(4)}, {geoState.lng.toFixed(4)}
      </span>
      <span className="text-xs text-gray-500">
        ±{Math.round(geoState.accuracy)}m
      </span>
    </div>
  );
}
