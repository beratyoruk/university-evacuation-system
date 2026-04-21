import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAppStore } from "../store/useAppStore";
import { gpsToBuilding, type BuildingOrigin } from "../utils/coordinates";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3001";
const UPDATE_INTERVAL = 1_000; // 1 second

export interface FloorSize {
  width: number;
  height: number;
}

/**
 * useLocation - Tracks the user's GPS position, converts it to floor
 * coordinates via affine transform + center offset, and pushes updates
 * over WebSocket.
 *
 * @param buildingOrigin  The building's GPS anchor + rotation for coordinate conversion
 * @param floorId         The floor the user is currently on
 * @param floorSize       Floor plan dimensions in meters; used to offset to plan center
 * @param enabled         Whether location tracking is active (default true)
 */
export function useLocation(
  buildingOrigin: BuildingOrigin | null,
  floorId: string | null,
  floorSize: FloorSize | null,
  enabled = true
) {
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const watchIdRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastSendRef = useRef(0);

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      if (!buildingOrigin || !floorId || !floorSize) return;

      const now = Date.now();
      if (now - lastSendRef.current < UPDATE_INTERVAL) return;
      lastSendRef.current = now;

      const raw = gpsToBuilding(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        buildingOrigin
      );

      // Building anchor → floor plan center
      const x = raw.x + floorSize.width / 2;
      const y = raw.y + floorSize.height / 2;

      setUserLocation({
        x,
        y,
        floorId,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });

      if (socketRef.current?.connected) {
        socketRef.current.emit("user:location", { floorId, x, y });
      }
    },
    [buildingOrigin, floorId, floorSize, setUserLocation]
  );

  const handleError = useCallback((error: GeolocationPositionError) => {
    console.warn("Geolocation error:", error.message);
  }, []);

  // WebSocket connection for sending location updates
  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem("token");
    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      auth: { token },
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  // Geolocation watcher
  useEffect(() => {
    if (!enabled || !buildingOrigin || !floorId) return;

    if (!("geolocation" in navigator)) {
      console.warn("Geolocation API not available");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: UPDATE_INTERVAL,
        timeout: 10_000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, buildingOrigin, floorId, handlePosition, handleError]);
}
