/**
 * GPS ↔ Building coordinate system transformations.
 *
 * The building coordinate system is a local 2D plane in meters,
 * with origin at the building's GPS anchor point (latitude, longitude).
 * An optional rotation angle aligns the building axes with the local grid.
 *
 * Uses an affine transformation:
 *   1. Convert GPS (lat/lng) to meters offset from origin
 *   2. Apply rotation to align with building axes
 */

/** Earth radius in meters (WGS84 mean) */
const EARTH_RADIUS = 6_371_000;

/** Degrees to radians */
function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Radians to degrees */
function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export interface BuildingOrigin {
  /** Anchor point latitude (decimal degrees) */
  latitude: number;
  /** Anchor point longitude (decimal degrees) */
  longitude: number;
  /** Building rotation in degrees (clockwise from north) */
  rotation: number;
}

export interface BuildingCoord {
  /** X position in meters from building origin */
  x: number;
  /** Y position in meters from building origin */
  y: number;
}

export interface GpsCoord {
  latitude: number;
  longitude: number;
}

/**
 * Convert GPS coordinates to building-local coordinates (meters).
 *
 * Steps:
 *   1. Compute meter offsets from the building origin using the haversine approximation
 *   2. Rotate by the building's orientation angle
 */
export function gpsToBuilding(
  gps: GpsCoord,
  origin: BuildingOrigin
): BuildingCoord {
  const latRad = degToRad(origin.latitude);

  // Meter offset from origin (equirectangular approximation — accurate for <1 km)
  const dx =
    (gps.longitude - origin.longitude) *
    degToRad(1) *
    EARTH_RADIUS *
    Math.cos(latRad);
  const dy =
    (gps.latitude - origin.latitude) * degToRad(1) * EARTH_RADIUS;

  // Apply building rotation (clockwise from north → standard math CCW)
  const theta = degToRad(-origin.rotation);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  return {
    x: dx * cosT - dy * sinT,
    y: dx * sinT + dy * cosT,
  };
}

/**
 * Convert building-local coordinates back to GPS.
 * Inverse of gpsToBuilding.
 */
export function buildingToGps(
  coord: BuildingCoord,
  origin: BuildingOrigin
): GpsCoord {
  // Inverse rotation
  const theta = degToRad(origin.rotation);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const dx = coord.x * cosT - coord.y * sinT;
  const dy = coord.x * sinT + coord.y * cosT;

  const latRad = degToRad(origin.latitude);

  const latitude =
    origin.latitude + radToDeg(dy / EARTH_RADIUS);
  const longitude =
    origin.longitude +
    radToDeg(dx / (EARTH_RADIUS * Math.cos(latRad)));

  return { latitude, longitude };
}

/**
 * Euclidean distance between two building coordinates (meters).
 */
export function distanceMeters(a: BuildingCoord, b: BuildingCoord): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Linear interpolation between two building coordinates.
 * t = 0 returns `from`, t = 1 returns `to`.
 */
export function lerpCoord(
  from: BuildingCoord,
  to: BuildingCoord,
  t: number
): BuildingCoord {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}
