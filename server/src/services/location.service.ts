/**
 * Location processing service.
 *
 * Handles coordinate normalization, nearest-waypoint lookups,
 * and floor detection utilities.
 */

interface WaypointRecord {
  id: string;
  x: number;
  y: number;
  connections: string[];
}

/**
 * Normalize raw coordinates to ensure they fall within valid bounds.
 * Clamps negative values to 0 and rounds to 2 decimal places.
 *
 * @param x - Raw X coordinate from client
 * @param y - Raw Y coordinate from client
 * @returns Normalized { x, y } object
 */
export function normalizeCoordinates(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(Math.max(0, x) * 100) / 100,
    y: Math.round(Math.max(0, y) * 100) / 100,
  };
}

/**
 * Find the nearest waypoint to a given (x, y) position
 * using Euclidean distance.
 *
 * @param x         - User's X position
 * @param y         - User's Y position
 * @param waypoints - Array of waypoint records from the database
 * @returns The closest waypoint and its distance, or null if the array is empty
 */
export function findNearestWaypoint(
  x: number,
  y: number,
  waypoints: WaypointRecord[]
): { id: string; x: number; y: number; distance: number } | null {
  if (waypoints.length === 0) return null;

  let nearest: { id: string; x: number; y: number; distance: number } | null = null;

  for (const wp of waypoints) {
    const dist = Math.sqrt((wp.x - x) ** 2 + (wp.y - y) ** 2);
    if (!nearest || dist < nearest.distance) {
      nearest = { id: wp.id, x: wp.x, y: wp.y, distance: dist };
    }
  }

  return nearest;
}

/**
 * Determine which floor a user is likely on based on vertical position.
 * Useful when the client provides a 3D coordinate and floor detection
 * must be inferred from height.
 *
 * @param zPosition   - Vertical position (altitude / height)
 * @param floorHeight - Assumed height per floor in meters (default 3.5m)
 * @returns The estimated floor number (0 = ground)
 */
export function detectFloorFromZ(zPosition: number, floorHeight: number = 3.5): number {
  if (zPosition < 0) return 0;
  return Math.floor(zPosition / floorHeight);
}

/**
 * Calculate the Euclidean distance between two 2D points.
 *
 * @param x1 - Point A x
 * @param y1 - Point A y
 * @param x2 - Point B x
 * @param y2 - Point B y
 * @returns Distance in coordinate units
 */
export function distance2D(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
