import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * react-three-fiber and drei rely on WebGL, which jsdom doesn't provide.
 * Mock the visual primitives down to plain DOM nodes so we can verify
 * component structure without a real GPU.
 */
vi.mock("@react-three/fiber", () => {
  const React = require("react");
  return {
    Canvas: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "r3f-canvas" }, children),
    useFrame: () => undefined,
  };
});

vi.mock("@react-three/drei", () => {
  const React = require("react");
  const stub = (name: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", { "data-testid": `drei-${name}` }, children);
  return {
    OrbitControls: stub("orbit-controls"),
    PerspectiveCamera: stub("camera"),
    Grid: stub("grid"),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("span", { "data-testid": "drei-text" }, children),
    // <Detailed> picks the first child (nearest LOD) in the mock — we don't
    // simulate distance-based switching in jsdom.
    Detailed: ({ children }: { children?: React.ReactNode }) => {
      const arr = React.Children.toArray(children);
      return React.createElement("div", { "data-testid": "drei-detailed" }, arr[0] ?? null);
    },
  };
});

// Lightweight stubs for the route visualizer & user marker to keep the test
// focused on the FloorViewer's top-level rendering contract.
vi.mock("../components/FloorViewer/UserMarker", () => ({
  default: ({ x, y }: { x: number; y: number }) => {
    const React = require("react");
    return React.createElement("div", {
      "data-testid": "user-marker",
      "data-x": x,
      "data-y": y,
    });
  },
}));

vi.mock("../components/FloorViewer/RouteVisualizer", () => ({
  default: () => {
    const React = require("react");
    return React.createElement("div", { "data-testid": "route-visualizer" });
  },
}));

import FloorViewer from "../components/FloorViewer/FloorViewer";

const planData = {
  walls: [
    { x1: 0, y1: 0, x2: 10, y2: 0 },
    { x1: 10, y1: 0, x2: 10, y2: 10 },
  ],
  rooms: [
    {
      id: "r1",
      name: "Lab 101",
      polygon: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      type: "lab",
    },
  ],
  exits: [
    { id: "e1", name: "Main Exit", x: 5, y: 10, type: "emergency" as const },
  ],
};

describe("FloorViewer", () => {
  it("renders a Canvas with plan contents", () => {
    const { getByTestId } = render(
      <FloorViewer
        planData={planData}
        route={null}
        userPosition={null}
        emergencyMode={false}
        width={20}
        height={20}
      />
    );
    expect(getByTestId("r3f-canvas")).toBeInTheDocument();
    expect(getByTestId("drei-camera")).toBeInTheDocument();
    expect(getByTestId("drei-orbit-controls")).toBeInTheDocument();
  });

  it("renders the user marker when a position is provided", () => {
    const { getByTestId } = render(
      <FloorViewer
        planData={planData}
        route={null}
        userPosition={{ x: 5, y: 5 }}
        emergencyMode={false}
      />
    );
    const marker = getByTestId("user-marker");
    expect(marker).toHaveAttribute("data-x", "5");
    expect(marker).toHaveAttribute("data-y", "5");
  });

  it("renders the route only in emergency mode", () => {
    const route = {
      path: ["w1"],
      coordinates: [{ x: 0, y: 0 }, { x: 5, y: 10 }],
      exitId: "e1",
      distance: 12,
    };

    const { queryByTestId, rerender } = render(
      <FloorViewer
        planData={planData}
        route={route}
        userPosition={null}
        emergencyMode={false}
      />
    );
    expect(queryByTestId("route-visualizer")).toBeNull();

    rerender(
      <FloorViewer
        planData={planData}
        route={route}
        userPosition={null}
        emergencyMode={true}
      />
    );
    expect(queryByTestId("route-visualizer")).toBeInTheDocument();
  });

  it("handles null planData without crashing", () => {
    const { getByTestId } = render(
      <FloorViewer
        planData={null}
        route={null}
        userPosition={null}
        emergencyMode={false}
      />
    );
    expect(getByTestId("r3f-canvas")).toBeInTheDocument();
  });
});
