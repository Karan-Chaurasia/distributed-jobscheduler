import apiClient from "./client";
import type { ApiResponse } from "../types";

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<ApiResponse<AuthResponse>>("/auth/login", data),

  register: (data: { firstName: string; lastName: string; email: string; password: string }) =>
    apiClient.post<ApiResponse<AuthResponse>>("/auth/register", data),

  logout: () =>
    apiClient.post("/auth/logout"),
};
