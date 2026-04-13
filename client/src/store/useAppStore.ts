import { create } from "zustand";
import type { PlanJSON, RouteData, UserPosition } from "../components/FloorViewer/FloorViewer";

interface UserLocation extends UserPosition {
  floorId: string;
  accuracy: number;
  timestamp: number;
}

interface FloorInfo {
  id: string;
  buildingId: string;
  floorNumber: number;
  name: string;
  width: number;
  height: number;
}

interface BuildingInfo {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  totalFloors: number;
}

interface AppState {
  // Building & floor
  currentBuilding: BuildingInfo | null;
  currentFloor: FloorInfo | null;
  floors: FloorInfo[];

  // User location
  userLocation: UserLocation | null;

  // Evacuation
  evacuationRoute: RouteData | null;
  emergencyMode: boolean;

  // Floor plan data cache (keyed by floor ID)
  floorPlans: Record<string, PlanJSON>;

  // Actions
  setCurrentBuilding: (building: BuildingInfo) => void;
  setCurrentFloor: (floor: FloorInfo) => void;
  setFloors: (floors: FloorInfo[]) => void;
  setUserLocation: (location: UserLocation) => void;
  setEvacuationRoute: (route: RouteData | null) => void;
  setEmergencyMode: (active: boolean) => void;
  setFloorPlan: (floorId: string, plan: PlanJSON) => void;
  reset: () => void;
}

const initialState = {
  currentBuilding: null,
  currentFloor: null,
  floors: [],
  userLocation: null,
  evacuationRoute: null,
  emergencyMode: false,
  floorPlans: {},
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setCurrentBuilding: (building) =>
    set({ currentBuilding: building }),

  setCurrentFloor: (floor) =>
    set({ currentFloor: floor }),

  setFloors: (floors) =>
    set({ floors }),

  setUserLocation: (location) =>
    set({ userLocation: location }),

  setEvacuationRoute: (route) =>
    set({ evacuationRoute: route }),

  setEmergencyMode: (active) =>
    set({ emergencyMode: active }),

  setFloorPlan: (floorId, plan) =>
    set((state) => ({
      floorPlans: { ...state.floorPlans, [floorId]: plan },
    })),

  reset: () => set(initialState),
}));
