import apiClient from "./client";
import type { ApiResponse, PagedResponse, Job } from "../types";

export const jobsApi = {
  findByQueue: (queueId: string, page = 0, size = 20) =>
    apiClient.get<ApiResponse<PagedResponse<Job>>>("/jobs", {
      params: { queueId, page, size },
    }),

  findById: (id: string) =>
    apiClient.get<ApiResponse<Job>>(`/jobs/${id}`),

  submit: (data: Partial<Job>) =>
    apiClient.post<ApiResponse<Job>>("/jobs", data),

  cancel: (id: string) =>
    apiClient.post<ApiResponse<Job>>(`/jobs/${id}/cancel`),

  retry: (id: string) =>
    apiClient.post<ApiResponse<Job>>(`/jobs/${id}/retry`),
};
