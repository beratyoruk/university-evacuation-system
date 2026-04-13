import client from "./client";

export interface Floor {
  id: string;
  buildingId: string;
  floorNumber: number;
  name: string;
  planUrl: string | null;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export interface FloorPayload {
  buildingId: string;
  floorNumber: number;
  name: string;
  width: number;
  height: number;
}

export interface PlanJSON {
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  rooms: Array<{
    id: string;
    name: string;
    polygon: Array<{ x: number; y: number }>;
    type: string;
  }>;
  exits: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    type: "door" | "staircase" | "elevator" | "emergency";
  }>;
}

export const floorsApi = {
  listByBuilding: (buildingId: string) =>
    client.get<{ data: Floor[] }>(`/buildings/${buildingId}/floors`),

  get: (id: string) =>
    client.get<{ data: Floor }>(`/floors/${id}`),

  create: (data: FloorPayload) =>
    client.post<{ data: Floor }>("/floors", data),

  update: (id: string, data: Partial<FloorPayload>) =>
    client.put<{ data: Floor }>(`/floors/${id}`, data),

  delete: (id: string) =>
    client.delete(`/floors/${id}`),

  getPlan: (floorId: string) =>
    client.get<{ data: { planJson: PlanJSON } }>(`/floors/${floorId}/plan`),

  savePlan: (floorId: string, planJson: PlanJSON) =>
    client.put(`/floors/${floorId}/plan`, { planJson }),

  uploadImage: (floorId: string, file: File) => {
    const form = new FormData();
    form.append("plan", file);
    return client.post(`/floors/${floorId}/upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
