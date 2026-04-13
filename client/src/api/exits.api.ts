import client from "./client";

export interface Exit {
  id: string;
  floorId: string;
  name: string;
  x: number;
  y: number;
  type: "door" | "staircase" | "elevator" | "emergency";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExitPayload {
  floorId: string;
  name: string;
  x: number;
  y: number;
  type: "door" | "staircase" | "elevator" | "emergency";
  isActive: boolean;
}

export const exitsApi = {
  listByFloor: (floorId: string) =>
    client.get<{ data: Exit[] }>(`/floors/${floorId}/exits`),

  get: (id: string) =>
    client.get<{ data: Exit }>(`/exits/${id}`),

  create: (data: ExitPayload) =>
    client.post<{ data: Exit }>("/exits", data),

  update: (id: string, data: Partial<ExitPayload>) =>
    client.put<{ data: Exit }>(`/exits/${id}`, data),

  delete: (id: string) =>
    client.delete(`/exits/${id}`),
};
