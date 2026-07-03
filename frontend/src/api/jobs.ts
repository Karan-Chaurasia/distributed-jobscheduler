import apiClient from "./client";
import type {
  ApiResponse,
  PagedResponse,
  Job,
  JobExecution,
} from "../types";

export interface CreateJobPayload {
  queueId: string;
  name: string;
  type: Job["type"];
  payload?: Record<string, unknown>;
  cronExpression?: string;
  scheduledAt?: string;
  maxAttempts?: number;
  priority?: number;
}

export const jobsApi = {
  findByQueue: (queueId: string, page = 0, size = 20) =>
    apiClient.get<ApiResponse<PagedResponse<Job>>>("/jobs", {
      params: { queueId, page, size },
    }),

  findById: (id: string) => apiClient.get<ApiResponse<Job>>(`/jobs/${id}`),

  submit: (data: CreateJobPayload) =>
    apiClient.post<ApiResponse<Job>>("/jobs", data),

  cancel: (id: string) =>
    apiClient.post<ApiResponse<Job>>(`/jobs/${id}/cancel`),

  retry: (id: string) => apiClient.post<ApiResponse<Job>>(`/jobs/${id}/retry`),

  executions: (id: string) =>
    apiClient.get<ApiResponse<JobExecution[]>>(`/jobs/${id}/executions`),
};
