import Redis, { Redis as RedisClient } from "ioredis";
import { config } from "../config";

/**
 * Small Redis wrapper used for caching floor plans and evacuation routes.
 * If Redis is unreachable the cache silently no-ops so the API keeps working.
 */

const DEFAULT_TTL_SECONDS = 5 * 60;

let client: RedisClient | null = null;
let warnedOffline = false;

function getClient(): RedisClient | null {
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_REDIS === "1") {
    return null;
  }
  if (client) return client;

  try {
    client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 500, 5_000),
    });

    client.on("error", (err) => {
      if (!warnedOffline) {
        console.warn(`[cache] Redis unavailable, running without cache (${err.message})`);
        warnedOffline = true;
      }
    });
    client.on("ready", () => {
      warnedOffline = false;
      console.log("[cache] Redis connected");
    });
  } catch (err) {
    console.warn("[cache] Failed to initialise Redis client:", err);
    client = null;
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const c = getClient();
  if (!c || c.status !== "ready") return null;
  try {
    const raw = await c.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const c = getClient();
  if (!c || c.status !== "ready") return;
  try {
    await c.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Silent fail — cache is a performance optimisation, not a requirement
  }
}

export async function cacheDel(pattern: string): Promise<void> {
  const c = getClient();
  if (!c || c.status !== "ready") return;
  try {
    if (!pattern.includes("*")) {
      await c.del(pattern);
      return;
    }
    const keys = await c.keys(pattern);
    if (keys.length) await c.del(...keys);
  } catch {
    // ignore
  }
}

export const cacheKeys = {
  floorDetail: (floorId: string) => `floor:detail:${floorId}`,
  floorsList: (buildingId: string) => `floors:list:${buildingId}`,
  route: (floorId: string, x: number, y: number, blocked: string) =>
    `route:${floorId}:${x.toFixed(2)}:${y.toFixed(2)}:${blocked || "none"}`,
  floorAll: (floorId: string) => `*${floorId}*`,
};
