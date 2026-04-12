import { create } from "zustand";

interface Emergency {
  id: string;
  buildingId: string;
  type: string;
  severity: string;
  status: string;
  description: string;
  startedAt: string;
}

interface EvacuationRoute {
  id: string;
  emergencyId: string;
  floorId: string;
  path: { nodeId: string; x: number; y: number; z: number; order: number }[];
  estimatedTime: number;
  distance: number;
  isBlocked: boolean;
}

interface EmergencyState {
  activeEmergency: Emergency | null;
  routes: EvacuationRoute[];
  isEvacuating: boolean;
  setEmergency: (emergency: Emergency, routes: EvacuationRoute[]) => void;
  clearEmergency: () => void;
  updateRoute: (route: EvacuationRoute) => void;
}

export const useEmergencyStore = create<EmergencyState>((set) => ({
  activeEmergency: null,
  routes: [],
  isEvacuating: false,

  setEmergency: (emergency, routes) =>
    set({ activeEmergency: emergency, routes, isEvacuating: true }),

  clearEmergency: () =>
    set({ activeEmergency: null, routes: [], isEvacuating: false }),

  updateRoute: (route) =>
    set((state) => ({
      routes: state.routes.map((r) => (r.id === route.id ? route : r)),
    })),
}));
