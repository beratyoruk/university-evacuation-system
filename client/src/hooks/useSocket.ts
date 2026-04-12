import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useEmergencyStore } from "../store/emergencyStore";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3001";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const setEmergency = useEmergencyStore((s) => s.setEmergency);
  const clearEmergency = useEmergencyStore((s) => s.clearEmergency);
  const updateRoute = useEmergencyStore((s) => s.updateRoute);

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("WebSocket connected:", socket.id);
    });

    socket.on("emergency:start", (data) => {
      setEmergency(data.emergency, data.routes);
    });

    socket.on("emergency:end", () => {
      clearEmergency();
    });

    socket.on("route:update", (data) => {
      updateRoute(data.route);
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, [setEmergency, clearEmergency, updateRoute]);

  return socketRef;
}
