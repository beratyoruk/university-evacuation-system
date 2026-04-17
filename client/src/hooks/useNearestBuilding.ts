import { useEffect, useRef, useState, useCallback } from "react";
import { buildingsApi, type Building, type NearestBuildingResponse } from "../api/buildings.api";

export interface GeoState {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export type GpsStatus = "waiting" | "active" | "denied" | "unavailable" | "timeout";

type NearestData = NonNullable<NearestBuildingResponse["data"]>;
type FloorEntry = NearestData["floors"][number];

export interface NearestBuildingResult {
  gpsStatus: GpsStatus;
  geoState: GeoState | null;
  building: (Building & { distance: number; floors: FloorEntry[] }) | null;
  floors: FloorEntry[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  setSimulatedPosition: (lat: number, lng: number) => void;
}

const NEARBY_THRESHOLD = 50;

interface UseNearestBuildingOptions {
  overrideLat?: number;
  overrideLng?: number;
}

export function useNearestBuilding(opts?: UseNearestBuildingOptions): NearestBuildingResult {
  const hasOverride =
    opts?.overrideLat !== undefined && opts?.overrideLng !== undefined &&
    Number.isFinite(opts.overrideLat) && Number.isFinite(opts.overrideLng);

  const [gpsStatus, setGpsStatus] = useState<GpsStatus>(hasOverride ? "active" : "waiting");
  const [geoState, setGeoState] = useState<GeoState | null>(
    hasOverride
      ? { lat: opts!.overrideLat!, lng: opts!.overrideLng!, accuracy: 1, timestamp: Date.now() }
      : null
  );
  const [building, setBuilding] = useState<NearestBuildingResult["building"]>(null);
  const [floors, setFloors] = useState<NearestBuildingResult["floors"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastFetchRef = useRef<string>("");
  const retryCounterRef = useRef(0);

  const setSimulatedPosition = useCallback((lat: number, lng: number) => {
    setGpsStatus("active");
    setGeoState({ lat, lng, accuracy: 1, timestamp: Date.now() });
    lastFetchRef.current = "";
  }, []);

  const startWatch = useCallback(() => {
    if (hasOverride) return;

    if (!("geolocation" in navigator)) {
      setGpsStatus("unavailable");
      setLoading(false);
      setError("Tarayıcınız konum desteği sunmuyor");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setGpsStatus("waiting");
    setLoading(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus("active");
        setGeoState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus("denied");
          setError("Konum izni reddedildi");
        } else if (err.code === err.TIMEOUT) {
          setGpsStatus("timeout");
          setError("Konum zaman aşımına uğradı");
        } else {
          setGpsStatus("unavailable");
          setError("Konum alınamadı");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000,
      }
    );
  }, [hasOverride]);

  useEffect(() => {
    startWatch();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [startWatch]);

  useEffect(() => {
    if (!geoState) return;

    const key = `${geoState.lat.toFixed(5)},${geoState.lng.toFixed(5)}`;
    if (key === lastFetchRef.current) return;
    lastFetchRef.current = key;

    let cancelled = false;

    async function fetchNearest() {
      setLoading(true);
      try {
        const res = await buildingsApi.nearest(geoState!.lat, geoState!.lng);
        if (cancelled) return;

        const data = res.data.data;
        if (data) {
          setBuilding({
            id: data.id,
            name: data.name,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            totalFloors: data.totalFloors,
            createdAt: "",
            updatedAt: "",
            distance: data.distance,
            floors: data.floors,
          });
          setFloors(data.floors);
          setError(null);
        } else {
          setBuilding(null);
          setFloors([]);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Bina bilgisi alınamadı");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNearest();
    return () => { cancelled = true; };
  }, [geoState]);

  const retry = useCallback(() => {
    retryCounterRef.current += 1;
    lastFetchRef.current = "";
    startWatch();
  }, [startWatch]);

  return { gpsStatus, geoState, building, floors, loading, error, retry, setSimulatedPosition };
}

export { NEARBY_THRESHOLD };
