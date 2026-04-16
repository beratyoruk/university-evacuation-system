import { useEffect, useState } from "react";
import api from "../utils/api";
import { useAppStore } from "../store/useAppStore";
import type { PlanJSON } from "../components/FloorViewer/FloorViewer";

/**
 * useFloorPlan - Fetches and caches the floor plan data for a given floor.
 *
 * Returns the parsed PlanJSON with walls, rooms, and exits.
 * Caches results in the global store so switching floors is instant on revisit.
 */
export function useFloorPlan(floorId: string | null) {
  const floorPlans = useAppStore((s) => s.floorPlans);
  const setFloorPlan = useAppStore((s) => s.setFloorPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cachedPlan = floorId ? floorPlans[floorId] ?? null : null;

  useEffect(() => {
    if (!floorId) return;

    const currentFloorId = floorId;
    let cancelled = false;

    async function fetchPlan() {
      setLoading(true);
      setError(null);

      try {
        const res = await api.get<{ data: { planJson: PlanJSON } }>(
          `/floors/${currentFloorId}/plan`
        );

        if (cancelled) return;

        const planData = res.data.data.planJson;

        // Validate basic structure
        const plan: PlanJSON = {
          walls: Array.isArray(planData?.walls) ? planData.walls : [],
          rooms: Array.isArray(planData?.rooms) ? planData.rooms : [],
          exits: Array.isArray(planData?.exits) ? planData.exits : [],
        };

        setFloorPlan(currentFloorId, plan);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch floor plan:", err);
          setError("Failed to load floor plan");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPlan();

    return () => {
      cancelled = true;
    };
  }, [floorId, cachedPlan, setFloorPlan]);

  return {
    planData: cachedPlan,
    loading,
    error,
  };
}
