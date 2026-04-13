import client from "./client";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export const authApi = {
  login: (data: LoginPayload) =>
    client.post<{ data: AuthResponse }>("/auth/login", data),

  register: (data: RegisterPayload) =>
    client.post<{ data: AuthResponse }>("/auth/register", data),
};
