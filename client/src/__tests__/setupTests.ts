import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Silence React's "unknown HTML tag" warnings from react-three-fiber primitives
// (mesh, boxGeometry, etc.) — they're rendered by our mocks, not real DOM.
const origError = console.error;
const SILENCED = [
  "unrecognized in this browser",
  "is using incorrect casing",
  "React does not recognize",
  "for a non-boolean attribute",
  "Unknown event handler property",
  "Invalid DOM property",
];
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === "string" && SILENCED.some((s) => first.includes(s))) {
    return;
  }
  origError(...(args as []));
};

// Polyfill matchMedia for components that react to color-scheme changes
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
    onchange: null,
  }));
}

// Silence noisy WebGL warnings from three.js in jsdom
if (!(HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext) {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
}
