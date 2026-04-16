import { describe, it, expect } from "vitest";
import {
  gpsToBuilding,
  buildingToGps,
  distanceMeters,
  lerpCoord,
  type BuildingOrigin,
} from "../utils/coordinates";

const origin: BuildingOrigin = {
  latitude: 41.1054,
  longitude: 29.0242,
  rotation: 0,
};

describe("gpsToBuilding", () => {
  it("maps the origin GPS to (0, 0)", () => {
    const c = gpsToBuilding(
      { latitude: origin.latitude, longitude: origin.longitude },
      origin
    );
    expect(c.x).toBeCloseTo(0, 4);
    expect(c.y).toBeCloseTo(0, 4);
  });

  it("maps a point due north to positive y and x≈0", () => {
    // ~1 meter north of origin
    const c = gpsToBuilding(
      { latitude: origin.latitude + 1 / 111_320, longitude: origin.longitude },
      origin
    );
    expect(Math.abs(c.x)).toBeLessThan(0.02);
    expect(c.y).toBeGreaterThan(0.9);
    expect(c.y).toBeLessThan(1.1);
  });

  it("maps a point due east to positive x and y≈0", () => {
    // ~1 meter east at the given latitude
    const c = gpsToBuilding(
      {
        latitude: origin.latitude,
        longitude:
          origin.longitude +
          1 / (111_320 * Math.cos((origin.latitude * Math.PI) / 180)),
      },
      origin
    );
    expect(c.x).toBeGreaterThan(0.9);
    expect(c.x).toBeLessThan(1.1);
    expect(Math.abs(c.y)).toBeLessThan(0.02);
  });

  it("applies building rotation correctly", () => {
    const rotated: BuildingOrigin = { ...origin, rotation: 90 };
    // A point directly east of origin should land on negative y when rotated 90° CW
    const c = gpsToBuilding(
      {
        latitude: origin.latitude,
        longitude:
          origin.longitude +
          1 / (111_320 * Math.cos((origin.latitude * Math.PI) / 180)),
      },
      rotated
    );
    expect(Math.abs(c.x)).toBeLessThan(0.2);
    expect(c.y).toBeLessThan(-0.5);
  });
});

describe("buildingToGps / gpsToBuilding round-trip", () => {
  it("round-trips a point through both conversions", () => {
    const gps = { latitude: 41.106, longitude: 29.025 };
    const local = gpsToBuilding(gps, origin);
    const back = buildingToGps(local, origin);
    expect(back.latitude).toBeCloseTo(gps.latitude, 5);
    expect(back.longitude).toBeCloseTo(gps.longitude, 5);
  });
});

describe("distanceMeters", () => {
  it("computes euclidean distance", () => {
    expect(distanceMeters({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("is zero for the same point", () => {
    expect(distanceMeters({ x: 7.5, y: -2 }, { x: 7.5, y: -2 })).toBe(0);
  });
});

describe("lerpCoord", () => {
  it("returns from at t=0 and to at t=1", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 10, y: 20 };
    expect(lerpCoord(from, to, 0)).toEqual({ x: 0, y: 0 });
    expect(lerpCoord(from, to, 1)).toEqual({ x: 10, y: 20 });
  });

  it("interpolates at midpoint", () => {
    const r = lerpCoord({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5);
    expect(r.x).toBe(5);
    expect(r.y).toBe(10);
  });
});
