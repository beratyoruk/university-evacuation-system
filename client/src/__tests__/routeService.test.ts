import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const postMock = vi.fn();

vi.mock("../api/client", () => ({
  default: {
    post: (...args: unknown[]) => postMock(...args),
  },
}));

// Imported after the mock so the service picks up the mocked client.
import { routeService } from "../services/routeService";

const SAMPLE_ROUTE = {
  path: ["A", "B"],
  coordinates: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 }, // final exit coordinate
  ],
  exitId: "exit-1",
  distance: 20,
};

beforeEach(() => {
  vi.useFakeTimers();
  postMock.mockReset();
  routeService.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("routeService", () => {
  it("debounces location updates before fetching", async () => {
    postMock.mockResolvedValue({ data: { data: SAMPLE_ROUTE } });

    routeService.updateLocation({
      buildingId: "b1", floorId: "f1", startX: 0, startY: 0,
    });
    routeService.updateLocation({
      buildingId: "b1", floorId: "f1", startX: 1, startY: 1,
    });
    routeService.updateLocation({
      buildingId: "b1", floorId: "f1", startX: 2, startY: 2,
    });

    // Not yet fired
    expect(postMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2100);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith("/evacuation/route", {
      buildingId: "b1", floorId: "f1", startX: 2, startY: 2,
    });
  });

  it("emits route updates to subscribers", async () => {
    postMock.mockResolvedValue({ data: { data: SAMPLE_ROUTE } });

    const listener = vi.fn();
    const unsubscribe = routeService.onRoute(listener);
    // Initial call fires with current (null) route
    expect(listener).toHaveBeenCalledWith(null);

    routeService.updateLocation({ buildingId: "b1", floorId: "f1", startX: 0, startY: 0 });
    await vi.advanceTimersByTimeAsync(2100);

    expect(listener).toHaveBeenLastCalledWith(SAMPLE_ROUTE);
    unsubscribe();
  });

  it("fires onArrival when user reaches the exit", async () => {
    postMock.mockResolvedValue({ data: { data: SAMPLE_ROUTE } });

    routeService.updateLocation({ buildingId: "b1", floorId: "f1", startX: 0, startY: 0 });
    await vi.advanceTimersByTimeAsync(2100);

    const arrival = vi.fn();
    routeService.onArrival(arrival);

    // Move close to the final coordinate (exit at 20,0)
    routeService.updateLocation({ buildingId: "b1", floorId: "f1", startX: 19, startY: 0 });
    expect(arrival).toHaveBeenCalledTimes(1);
  });

  it("falls back to cached route on network failure", async () => {
    // Success: first fetch populates the cache
    postMock.mockResolvedValueOnce({ data: { data: SAMPLE_ROUTE } });
    routeService.updateLocation({ buildingId: "b1", floorId: "f1", startX: 0, startY: 0 });
    await vi.advanceTimersByTimeAsync(2100);
    expect(routeService.getRoute()).toEqual(SAMPLE_ROUTE);

    // Clear current state, then fail: should restore from cache
    routeService.clear();
    postMock.mockRejectedValueOnce(new Error("offline"));
    routeService.updateLocation({ buildingId: "b1", floorId: "f1", startX: 0, startY: 0 });
    await vi.advanceTimersByTimeAsync(2100);

    expect(routeService.getRoute()).toEqual(SAMPLE_ROUTE);
  });

  it("clears the current route", async () => {
    postMock.mockResolvedValue({ data: { data: SAMPLE_ROUTE } });
    routeService.updateLocation({ buildingId: "b1", floorId: "f1", startX: 0, startY: 0 });
    await vi.advanceTimersByTimeAsync(2100);
    expect(routeService.getRoute()).not.toBeNull();

    routeService.clear();
    expect(routeService.getRoute()).toBeNull();
  });
});
