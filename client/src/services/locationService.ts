import { io, Socket } from "socket.io-client";
import { gpsToBuilding, type BuildingOrigin } from "../utils/coordinates";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3001";

export interface FloorSize {
  width: number;
  height: number;
}

export interface LocationSample {
  x: number;
  y: number;
  accuracy: number;
  timestamp: number;
  floorId: string;
  /** Compass heading in degrees (0 = north), null if unavailable */
  heading: number | null;
  /** Speed in m/s, null if unavailable */
  speed: number | null;
}

export interface WifiReading {
  ssid?: string;
  bssid?: string;
  rssi: number;
  frequency?: number;
}

/**
 * 1D Kalman filter applied independently to X and Y coordinates.
 * Tuned for real-time responsiveness: trusts new measurements more so the
 * user sees their movement reflected immediately, while still damping jitter
 * from high-error fixes. Snaps (resets state) on large jumps so a GPS
 * correction doesn't drag the smoothed position along the old track.
 */
class Kalman2D {
  private x: number | null = null;
  private y: number | null = null;
  private pX = 1;
  private pY = 1;
  private readonly q = 0.6;           // high process noise — trust motion
  private readonly rBase = 0.4;       // small base measurement noise
  private readonly rAccuracyScale = 0.2;
  private readonly snapDistance = 25; // meters — jump threshold

  update(mx: number, my: number, accuracy: number): { x: number; y: number } {
    if (this.x === null || this.y === null) {
      this.x = mx;
      this.y = my;
      return { x: mx, y: my };
    }

    // Huge jump → probably a corrected fix; reseed rather than average across.
    const dx = mx - this.x;
    const dy = my - this.y;
    if (Math.hypot(dx, dy) > this.snapDistance) {
      this.x = mx;
      this.y = my;
      this.pX = 1;
      this.pY = 1;
      return { x: mx, y: my };
    }

    const r = Math.max(this.rBase, accuracy * this.rAccuracyScale);

    this.pX += this.q;
    const kX = this.pX / (this.pX + r);
    this.x = this.x + kX * (mx - this.x);
    this.pX = (1 - kX) * this.pX;

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
  private socket: Socket | null = null;
  private listeners = new Set<LocationListener>();
  private kalman = new Kalman2D();

  private buildingOrigin: BuildingOrigin | null = null;
  private floorId: string | null = null;
  private floorSize: FloorSize = { width: 0, height: 0 };
  private lastSent = 0;
  private readonly sendIntervalMs = 1000;

  private wifiReadings: WifiReading[] = [];

  /**
   * Configure the active building/floor. Safe to call multiple times.
   * Call `ingestGps()` from a single source of truth (e.g. the GPS watcher in
   * useNearestBuilding) to feed positions in.
   */
  start(buildingOrigin: BuildingOrigin, floorId: string, floorSize: FloorSize): void {
    const changed =
      this.buildingOrigin?.latitude !== buildingOrigin.latitude ||
      this.buildingOrigin?.longitude !== buildingOrigin.longitude ||
      this.floorId !== floorId;

    this.buildingOrigin = buildingOrigin;
    this.floorId = floorId;
    this.floorSize = floorSize;
    if (changed) this.kalman.reset();

    if (!this.socket) {
      this.connectSocket();
    }
  }

  /** Feed a GPS sample in. Convert, smooth, broadcast. */
  ingestGps(
    lat: number,
    lng: number,
    accuracy: number,
    timestamp: number,
    heading: number | null = null,
    speed: number | null = null
  ): void {
    this.handleGps(lat, lng, accuracy, timestamp, heading, speed);
  }

  stop(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.kalman.reset();
    this.buildingOrigin = null;
    this.floorId = null;
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

  private handleGps(
    lat: number,
    lng: number,
    accuracy: number,
    timestamp: number,
    heading: number | null,
    speed: number | null
  ): void {
    if (!this.buildingOrigin || !this.floorId) return;

    const raw = gpsToBuilding(
      { latitude: lat, longitude: lng },
      this.buildingOrigin
    );

    // Building GPS anchor maps to floor plan CENTER.
    const floorX = raw.x + this.floorSize.width / 2;
    const floorY = raw.y + this.floorSize.height / 2;

    const smoothed = this.kalman.update(floorX, floorY, accuracy);

    const sample: LocationSample = {
      x: smoothed.x,
      y: smoothed.y,
      accuracy,
      timestamp,
      floorId: this.floorId,
      heading,
      speed,
    };

    this.listeners.forEach((fn) => fn(sample));

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
