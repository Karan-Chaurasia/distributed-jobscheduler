import apiClient from "./client";
import type { ApiResponse, PagedResponse, Queue } from "../types";

export const queuesApi = {
  findByProject: (projectId: string, page = 0, size = 20) =>
    apiClient.get<ApiResponse<PagedResponse<Queue>>>("/queues", {
      params: { projectId, page, size },
    }),

  findById: (id: string) =>
    apiClient.get<ApiResponse<Queue>>(`/queues/${id}`),

  create: (data: Partial<Queue>) =>
    apiClient.post<ApiResponse<Queue>>("/queues", data),

  pause: (id: string) =>
    apiClient.post<ApiResponse<Queue>>(`/queues/${id}/pause`),

  resume: (id: string) =>
    apiClient.post<ApiResponse<Queue>>(`/queues/${id}/resume`),

  delete: (id: string) =>
    apiClient.delete(`/queues/${id}`),
};
