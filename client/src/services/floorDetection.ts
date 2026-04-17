type FloorChangeListener = (floorIndex: number) => void;

/**
 * FloorDetectionService — currently manual floor selection.
 *
 * Future: listen to DeviceMotionEvent + Barometer API (if available) to
 * detect floor changes automatically. The barometer stub is wired up
 * below but gated behind feature flags and sensor availability.
 */
class FloorDetectionService {
  private currentFloorIndex = 0;
  private listeners = new Set<FloorChangeListener>();
  private barometerSupported = false;
  private motionCleanup: (() => void) | null = null;

  setFloor(index: number) {
    if (index === this.currentFloorIndex) return;
    this.currentFloorIndex = index;
    this.listeners.forEach((fn) => fn(index));
  }

  getFloor() {
    return this.currentFloorIndex;
  }

  onChange(fn: FloorChangeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Start passive barometer / device-motion listeners (stub).
   * On supported devices this would read pressure changes to infer
   * floor transitions (~1.2 hPa ≈ 1 floor). Currently a no-op.
   */
  startAutoDetection() {
    if (typeof window === "undefined") return;

    if ("Sensor" in window && "AbsoluteOrientationSensor" in window) {
      this.barometerSupported = true;
    }

    if ("DeviceMotionEvent" in window) {
      const handler = (_e: DeviceMotionEvent) => {
        // Placeholder: accumulate vertical acceleration data to detect
        // stairwell traversal. Will be implemented when sensor fusion is ready.
      };
      window.addEventListener("devicemotion", handler);
      this.motionCleanup = () => window.removeEventListener("devicemotion", handler);
    }
  }

  stopAutoDetection() {
    this.motionCleanup?.();
    this.motionCleanup = null;
  }

  isBarometerAvailable() {
    return this.barometerSupported;
  }
}

export const floorDetection = new FloorDetectionService();
