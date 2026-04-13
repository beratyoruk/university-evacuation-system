import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAppStore } from "../store/useAppStore";
import { gpsToBuilding, type BuildingOrigin } from "../utils/coordinates";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3001";
const UPDATE_INTERVAL = 1_000; // 1 second

/**
 * useLocation - Tracks the user's GPS position, converts it to building
 * coordinates via affine transform, and pushes updates over WebSocket.
 *
 * @param buildingOrigin  The building's GPS anchor + rotation for coordinate conversion
 * @param floorId         The floor the user is currently on
 * @param enabled         Whether location tracking is active (default true)
 */
export function useLocation(
  buildingOrigin: BuildingOrigin | null,
  floorId: string | null,
  enabled = true
) {
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const watchIdRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastSendRef = useRef(0);

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      if (!buildingOrigin || !floorId) return;

      const now = Date.now();
      if (now - lastSendRef.current < UPDATE_INTERVAL) return;
      lastSendRef.current = now;

      const buildingCoord = gpsToBuilding(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        buildingOrigin
      );

      const location = {
        x: buildingCoord.x,
        y: buildingCoord.y,
        floorId,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };

      setUserLocation(location);

      // Send to server
      if (socketRef.current?.connected) {
        socketRef.current.emit("user:location", {
          floorId,
          x: buildingCoord.x,
          y: buildingCoord.y,
        });
      }
    },
    [buildingOrigin, floorId, setUserLocation]
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
