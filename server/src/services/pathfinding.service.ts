/**
 * A* pathfinding service for evacuation route calculation.
 *
 * Takes a waypoint graph (nodes with x, y coordinates and adjacency lists)
 * and finds the shortest path from a starting waypoint to the nearest
 * emergency exit. Supports blocking waypoints to model obstructed paths
 * (e.g. closed doors, fire zones).
 */

interface Waypoint {
  id: string;
  x: number;
  y: number;
  connections: string[];
}

interface ExitPoint {
  id: string;
  x: number;
  y: number;
}

interface RouteResult {
  /** Ordered waypoint IDs from start to the exit-adjacent waypoint */
  path: string[];
  /** Coordinates along the route for rendering */
  coordinates: Array<{ x: number; y: number }>;
  /** Target exit ID */
  exitId: string;
  /** Total Euclidean distance of the path */
  distance: number;
}

/**
 * Euclidean distance between two 2D points.
 * @param x1 - X coordinate of point A
 * @param y1 - Y coordinate of point A
 * @param x2 - X coordinate of point B
 * @param y2 - Y coordinate of point B
 * @returns Distance in coordinate units
 */
function euclidean(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * A* search from a single source waypoint to a single target waypoint.
 *
 * Uses Euclidean distance as the heuristic (admissible for 2D grids
 * with straight-line movement allowed).
 *
 * @param waypoints   - All waypoints on the floor (the navigation graph)
 * @param startId     - Source waypoint ID
 * @param goalX       - X coordinate of the goal (for the heuristic)
 * @param goalY       - Y coordinate of the goal (for the heuristic)
 * @param goalNeighborIds - Set of waypoint IDs that are adjacent to the goal
 *                          (any of these counts as "reached the exit")
 * @param blockedIds  - Waypoint IDs to treat as impassable
 * @returns The path of waypoint IDs from start to the goal-adjacent node, or null
 */
function astar(
  waypointMap: Map<string, Waypoint>,
  startId: string,
  goalX: number,
  goalY: number,
  goalNeighborIds: Set<string>,
  blockedIds: Set<string>
): { path: string[]; distance: number } | null {
  // gScore: cost of cheapest path from start to node
  const gScore = new Map<string, number>();
  // fScore: gScore + heuristic estimate to goal
  const fScore = new Map<string, number>();
  // cameFrom: for path reconstruction
  const cameFrom = new Map<string, string>();
  // openSet as a simple sorted list (adequate for <10k nodes)
  const openSet = new Set<string>();
  const closedSet = new Set<string>();

  gScore.set(startId, 0);

  const startWp = waypointMap.get(startId);
  if (!startWp) return null;

  fScore.set(startId, euclidean(startWp.x, startWp.y, goalX, goalY));
  openSet.add(startId);

  while (openSet.size > 0) {
    // Pick the node in openSet with the lowest fScore
    let current: string | null = null;
    let currentF = Infinity;
    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity;
      if (f < currentF) {
        currentF = f;
        current = id;
      }
    }

    if (!current) break;

    // Check if we've reached a waypoint adjacent to the exit
    if (goalNeighborIds.has(current)) {
      // Reconstruct path
      const path: string[] = [];
      let node: string | undefined = current;
      while (node) {
        path.unshift(node);
        node = cameFrom.get(node);
      }
      return { path, distance: gScore.get(current) ?? 0 };
    }

    openSet.delete(current);
    closedSet.add(current);

    const currentWp = waypointMap.get(current);
    if (!currentWp) continue;

    // Parse connections (handle both string[] and JSON string)
    let neighbors: string[];
    if (typeof currentWp.connections === "string") {
      try {
        neighbors = JSON.parse(currentWp.connections);
      } catch {
        neighbors = [];
      }
    } else {
      neighbors = currentWp.connections;
    }

    for (const neighborId of neighbors) {
      if (closedSet.has(neighborId) || blockedIds.has(neighborId)) continue;

      const neighborWp = waypointMap.get(neighborId);
      if (!neighborWp) continue;

      const tentativeG =
        (gScore.get(current) ?? Infinity) +
        euclidean(currentWp.x, currentWp.y, neighborWp.x, neighborWp.y);

      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, current);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + euclidean(neighborWp.x, neighborWp.y, goalX, goalY));
        openSet.add(neighborId);
      }
    }
  }

  return null; // No path found
}

/**
 * Find the best evacuation route from a starting waypoint to the
 * nearest emergency exit.
 *
 * Iterates over all emergency exits, runs A* to each, and returns
 * the shortest overall route. Blocked waypoints are excluded from
 * the search graph.
 *
 * @param waypoints  - All waypoints on the floor
 * @param exits      - Emergency exits on the floor
 * @param startId    - The waypoint closest to the user's position
 * @param blockedIds - Waypoint IDs to treat as impassable (fire, locked doors, etc.)
 * @returns The optimal route, or null if all paths are blocked
 */
export function findEvacuationRoute(
  waypoints: Waypoint[],
  exits: ExitPoint[],
  startId: string,
  blockedIds: string[] = []
): RouteResult | null {
  const blockedSet = new Set(blockedIds);
  const waypointMap = new Map<string, Waypoint>();

  for (const wp of waypoints) {
    waypointMap.set(wp.id, wp);
  }

  let bestRoute: RouteResult | null = null;

  for (const exit of exits) {
    // Find waypoints that are close to this exit (within threshold)
    // We treat any waypoint within 15 units of the exit as a valid "goal neighbor"
    const goalNeighborIds = new Set<string>();
    for (const wp of waypoints) {
      if (blockedSet.has(wp.id)) continue;
      if (euclidean(wp.x, wp.y, exit.x, exit.y) <= 15) {
        goalNeighborIds.add(wp.id);
      }
    }

    // Also check if startId itself is close to this exit
    if (goalNeighborIds.has(startId)) {
      const startWp = waypointMap.get(startId);
      if (startWp) {
        const dist = euclidean(startWp.x, startWp.y, exit.x, exit.y);
        if (!bestRoute || dist < bestRoute.distance) {
          bestRoute = {
            path: [startId],
            coordinates: [
              { x: startWp.x, y: startWp.y },
              { x: exit.x, y: exit.y },
            ],
            exitId: exit.id,
            distance: dist,
          };
        }
      }
      continue;
    }

    if (goalNeighborIds.size === 0) continue;

    const result = astar(waypointMap, startId, exit.x, exit.y, goalNeighborIds, blockedSet);

    if (!result) continue;

    // Add the distance from the last waypoint to the exit itself
    const lastWp = waypointMap.get(result.path[result.path.length - 1]);
    const totalDistance = lastWp
      ? result.distance + euclidean(lastWp.x, lastWp.y, exit.x, exit.y)
      : result.distance;

    if (!bestRoute || totalDistance < bestRoute.distance) {
      const coordinates = result.path.map((id) => {
        const wp = waypointMap.get(id)!;
        return { x: wp.x, y: wp.y };
      });
      // Append the exit coordinate as the final point
      coordinates.push({ x: exit.x, y: exit.y });

      bestRoute = {
        path: result.path,
        coordinates,
        exitId: exit.id,
        distance: totalDistance,
      };
    }
  }

  return bestRoute;
}
