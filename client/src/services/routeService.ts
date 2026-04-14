import client from "../api/client";
import type { RouteData } from "../components/FloorViewer/FloorViewer";

const CACHE_KEY = "evac-route-cache";
const DEBOUNCE_MS = 2000;
const ARRIVAL_THRESHOLD_METERS = 5;

interface RouteRequest {
  buildingId: string;
  floorId: string;
  startX: number;
  startY: number;
}

interface CachedRoute {
  request: RouteRequest;
  route: RouteData;
  fetchedAt: number;
}

type RouteListener = (route: RouteData | null) => void;
type ArrivalListener = () => void;

/**
 * RouteService - manages A* route calculation with debounce,
 * arrival detection, and offline caching.
 *
 * The service watches location updates pushed via `updateLocation()`,
 * debounces requests to the backend pathfinding endpoint, and emits
 * the latest route to subscribers. On network failure, the last
 * successful route is served from localStorage.
 */
class RouteService {
  private currentRoute: RouteData | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private routeListeners = new Set<RouteListener>();
  private arrivalListeners = new Set<ArrivalListener>();
  private lastRequest: RouteRequest | null = null;
  private arrived = false;

  /** Subscribe to route updates. Fires immediately with the current route. */
  onRoute(fn: RouteListener): () => void {
    this.routeListeners.add(fn);
    fn(this.currentRoute);
    return () => this.routeListeners.delete(fn);
  }

  /** Subscribe to the "reached exit" event. */
  onArrival(fn: ArrivalListener): () => void {
    this.arrivalListeners.add(fn);
    return () => this.arrivalListeners.delete(fn);
  }

  /**
   * Call whenever the user's location changes. Triggers a debounced
   * recalculation and checks arrival against the current route.
   */
  updateLocation(req: RouteRequest): void {
    this.lastRequest = req;

    // Arrival check against existing route
    if (this.currentRoute && this.currentRoute.coordinates.length > 0) {
      const exit = this.currentRoute.coordinates[this.currentRoute.coordinates.length - 1];
      const distance = Math.hypot(exit.x - req.startX, exit.y - req.startY);
      if (distance <= ARRIVAL_THRESHOLD_METERS && !this.arrived) {
        this.arrived = true;
        this.arrivalListeners.forEach((fn) => fn());
      } else if (distance > ARRIVAL_THRESHOLD_METERS + 2) {
        this.arrived = false;
      }
    }

    // Debounced fetch
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.fetchRoute(req);
    }, DEBOUNCE_MS);
  }

  /** Force an immediate route fetch without debounce. */
  async refresh(): Promise<void> {
    if (this.lastRequest) await this.fetchRoute(this.lastRequest);
  }

  /** Clear the active route. */
  clear(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.currentRoute = null;
    this.arrived = false;
    this.emitRoute(null);
  }

  /** Current route snapshot. */
  getRoute(): RouteData | null {
    return this.currentRoute;
  }

  private async fetchRoute(req: RouteRequest): Promise<void> {
    try {
      const res = await client.post<{ data: RouteData }>("/evacuation/route", {
        buildingId: req.buildingId,
        floorId: req.floorId,
        startX: req.startX,
        startY: req.startY,
      });

      const route = res.data.data;
      this.currentRoute = route;
      this.emitRoute(route);
      this.cache({ request: req, route, fetchedAt: Date.now() });
    } catch (err) {
      console.warn("[routeService] Route fetch failed, using cache:", err);
      const cached = this.loadCache();
      if (cached && cached.request.floorId === req.floorId) {
        this.currentRoute = cached.route;
        this.emitRoute(cached.route);
      }
    }
  }

  private emitRoute(route: RouteData | null): void {
    this.routeListeners.forEach((fn) => fn(route));
  }

  private cache(cached: CachedRoute): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    } catch {
      // Quota exceeded or private mode — ignore
    }
  }

  private loadCache(): CachedRoute | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CachedRoute;
    } catch {
      return null;
    }
  }
}

export const routeService = new RouteService();
