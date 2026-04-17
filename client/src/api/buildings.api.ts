import client from "./client";

export interface Building {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  totalFloors: number;
  createdAt: string;
  updatedAt: string;
}

export interface NearestBuildingResponse {
  data: (Building & {
    distance: number;
    floors: Array<{
      id: string;
      buildingId: string;
      floorNumber: number;
      name: string;
      planUrl: string | null;
      planJson: unknown;
    }>;
  }) | null;
  reason?: string;
  nearestDistance?: number | null;
}

export interface BuildingPayload {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  totalFloors: number;
}

export const buildingsApi = {
  list: () =>
    client.get<{ data: Building[] }>("/buildings"),

  get: (id: string) =>
    client.get<{ data: Building }>(`/buildings/${id}`),

  nearest: (lat: number, lng: number, radius = 500) =>
    client.get<NearestBuildingResponse>(`/buildings/nearest?lat=${lat}&lng=${lng}&radius=${radius}`),

  create: (data: BuildingPayload) =>
    client.post<{ data: Building }>("/buildings", data),

  update: (id: string, data: Partial<BuildingPayload>) =>
    client.put<{ data: Building }>(`/buildings/${id}`, data),

  delete: (id: string) =>
    client.delete(`/buildings/${id}`),
};
