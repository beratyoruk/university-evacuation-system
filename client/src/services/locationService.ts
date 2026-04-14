import { io, Socket } from "socket.io-client";
import { gpsToBuilding, type BuildingOrigin } from "../utils/coordinates";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3001";

export interface LocationSample {
  x: number;
  y: number;
  accuracy: number;
  timestamp: number;
  floorId: string;
}

export interface WifiReading {
  ssid?: string;
  bssid?: string;
  rssi: number;
  frequency?: number;
}

/**
 * 1D Kalman filter applied independently to X and Y coordinates.
 * Damps GPS jitter without introducing noticeable lag.
 */
class Kalman2D {
  private x: number | null = null;
  private y: number | null = null;
  private pX = 1;
  private pY = 1;
  private readonly q = 0.05; // process noise — how much we trust new measurements
  private readonly r = 2.0; // measurement noise — higher = smoother

  update(mx: number, my: number, accuracy: number): { x: number; y: number } {
    // First sample → seed
    if (this.x === null || this.y === null) {
      this.x = mx;
      this.y = my;
      return { x: mx, y: my };
    }

    // Scale measurement noise by GPS accuracy (meters)
    const r = Math.max(this.r, accuracy * 0.5);

    // X
    this.pX += this.q;
    const kX = this.pX / (this.pX + r);
    this.x = this.x + kX * (mx - this.x);
    this.pX = (1 - kX) * this.pX;

    // Y
    this.pY += this.q;
    const kY = this.pY / (this.pY + r);
    this.y = this.y + kY * (my - this.y);
    this.pY = (1 - kY) * this.pY;

    return { x: this.x, y: this.y };
  }

  reset() {
    this.x = null;
    this.y = null;
    this.pX = 1;
    this.pY = 1;
  }
}

type LocationListener = (sample: LocationSample) => void;

/**
 * LocationService - singleton that manages GPS tracking, smoothing,
 * and WebSocket broadcasting for a user's position inside a building.
 *
 * Use `start()` to begin watching, `onUpdate()` to subscribe to smoothed samples.
 */
class LocationService {
  private watchId: number | null = null;
  private socket: Socket | null = null;
  private listeners = new Set<LocationListener>();
  private kalman = new Kalman2D();

  private buildingOrigin: BuildingOrigin | null = null;
  private floorId: string | null = null;
  private lastSent = 0;
  private readonly sendIntervalMs = 1000;

  private wifiReadings: WifiReading[] = [];

  /** Start tracking position. Safe to call multiple times — reconfigures. */
  start(buildingOrigin: BuildingOrigin, floorId: string): void {
    this.buildingOrigin = buildingOrigin;
    this.floorId = floorId;
    this.kalman.reset();

    if (!this.socket) {
      this.connectSocket();
    }

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    if (!("geolocation" in navigator)) {
      console.warn("[locationService] Geolocation API not available");
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => console.warn("[locationService] GPS error:", err.message),
      {
        enableHighAccuracy: true,
        maximumAge: 500,
        timeout: 10_000,
      }
    );
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.kalman.reset();
  }

  onUpdate(fn: LocationListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Push a Wi-Fi RSSI reading into the collection.
   * The standard browser Navigator API does not expose Wi-Fi scans directly,
   * so this is typically fed from a native bridge / companion app.
   * We keep the last N readings and send them alongside position updates.
   */
  addWifiReading(reading: WifiReading): void {
    this.wifiReadings.push(reading);
    if (this.wifiReadings.length > 10) {
      this.wifiReadings.shift();
    }
  }

  private connectSocket(): void {
    const token = localStorage.getItem("token");
    this.socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      auth: { token },
    });
  }

  private handlePosition(position: GeolocationPosition): void {
    if (!this.buildingOrigin || !this.floorId) return;

    const raw = gpsToBuilding(
      {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      this.buildingOrigin
    );

    // Smooth through Kalman filter
    const smoothed = this.kalman.update(raw.x, raw.y, position.coords.accuracy);

    const sample: LocationSample = {
      x: smoothed.x,
      y: smoothed.y,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      floorId: this.floorId,
    };

    this.listeners.forEach((fn) => fn(sample));

    // Rate-limited WebSocket push
    const now = Date.now();
    if (now - this.lastSent >= this.sendIntervalMs && this.socket?.connected) {
      this.lastSent = now;
      this.socket.emit("user:location", {
        floorId: this.floorId,
        x: sample.x,
        y: sample.y,
        accuracy: sample.accuracy,
        wifi: this.wifiReadings.length > 0 ? this.wifiReadings : undefined,
      });
    }
  }
}

export const locationService = new LocationService();
