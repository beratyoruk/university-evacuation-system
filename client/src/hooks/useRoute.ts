import { useEffect, useCallback } from "react";
import api from "../utils/api";
import { useAppStore } from "../store/useAppStore";
import type { RouteData } from "../components/FloorViewer/FloorViewer";

const REROUTE_INTERVAL = 10_000; // Re-check route every 10 seconds during emergency

/**
 * useRoute - Fetches the optimal evacuation route from the backend
 * and keeps it updated while emergency mode is active.
 *
 * Sends the user's current position and floor to the pathfinding
 * service, which returns an A* computed route to the nearest exit.
 */
export function useRoute(buildingId: string | null) {
  const userLocation = useAppStore((s) => s.userLocation);
  const emergencyMode = useAppStore((s) => s.emergencyMode);
  const setEvacuationRoute = useAppStore((s) => s.setEvacuationRoute);

  const fetchRoute = useCallback(async () => {
    if (!buildingId || !userLocation || !emergencyMode) {
      return;
    }

    try {
      const res = await api.post<{ data: RouteData }>("/evacuation/route", {
        buildingId,
        floorId: userLocation.floorId,
        startX: userLocation.x,
        startY: userLocation.y,
      });

      setEvacuationRoute(res.data.data);
    } catch (err) {
      console.error("Failed to fetch evacuation route:", err);
    }
  }, [buildingId, userLocation, emergencyMode, setEvacuationRoute]);

  // Initial route fetch when emergency starts or user location changes significantly
  useEffect(() => {
    if (!emergencyMode || !userLocation) {
      setEvacuationRoute(null);
      return;
    }

    fetchRoute();
  }, [emergencyMode, userLocation?.floorId, fetchRoute, setEvacuationRoute]);

  // Periodic route refresh during emergency
  useEffect(() => {
    if (!emergencyMode || !userLocation) return;

    const interval = setInterval(fetchRoute, REROUTE_INTERVAL);
    return () => clearInterval(interval);
  }, [emergencyMode, userLocation?.floorId, fetchRoute]);
}
