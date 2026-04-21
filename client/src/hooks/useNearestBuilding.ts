import { useEffect, useRef, useState, useCallback } from "react";
import { buildingsApi, type Building, type NearestBuildingResponse } from "../api/buildings.api";

export interface GeoState {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  heading: number | null;
  speed: number | null;
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
/** Don't refetch /nearest unless user moved at least this far since last fetch. */
const REFETCH_DISTANCE_M = 25;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

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
      ? { lat: opts!.overrideLat!, lng: opts!.overrideLng!, accuracy: 1, timestamp: Date.now(), heading: null, speed: null }
      : null
  );
  const [building, setBuilding] = useState<NearestBuildingResult["building"]>(null);
  const [floors, setFloors] = useState<NearestBuildingResult["floors"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastFetchAnchorRef = useRef<{ lat: number; lng: number } | null>(null);
  const retryCounterRef = useRef(0);

  const setSimulatedPosition = useCallback((lat: number, lng: number) => {
    setGpsStatus("active");
    setGeoState({ lat, lng, accuracy: 1, timestamp: Date.now(), heading: null, speed: null });
    lastFetchAnchorRef.current = null;
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
          heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
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

    // Skip refetch if we've already resolved a building and the user hasn't
    // moved meaningfully since the last fetch — prevents one /nearest call
    // per GPS sample during movement.
    const anchor = lastFetchAnchorRef.current;
    if (anchor) {
      const moved = haversineMeters(anchor.lat, anchor.lng, geoState.lat, geoState.lng);
      if (moved < REFETCH_DISTANCE_M) return;
    }
    lastFetchAnchorRef.current = { lat: geoState.lat, lng: geoState.lng };

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
    lastFetchAnchorRef.current = null;
    startWatch();
  }, [startWatch]);

  return { gpsStatus, geoState, building, floors, loading, error, retry, setSimulatedPosition };
}

export { NEARBY_THRESHOLD };
