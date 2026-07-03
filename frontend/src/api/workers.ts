import apiClient from "./client";
import type { ApiResponse, Worker } from "../types";

export const workersApi = {
  findAll: () => apiClient.get<ApiResponse<Worker[]>>("/workers"),
};
