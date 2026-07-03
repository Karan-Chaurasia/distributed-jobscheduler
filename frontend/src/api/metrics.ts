import apiClient from "./client";
import type { ApiResponse, SystemMetrics } from "../types";

export const metricsApi = {
  overview: () => apiClient.get<ApiResponse<SystemMetrics>>("/metrics/overview"),
};
