import apiClient from "./client";
import type { ApiResponse, PagedResponse, Organization } from "../types";

export const organizationsApi = {
  findAll: (page = 0, size = 50) =>
    apiClient.get<ApiResponse<PagedResponse<Organization>>>("/organizations", {
      params: { page, size },
    }),

  create: (data: { name: string; slug: string; description?: string }) =>
    apiClient.post<ApiResponse<Organization>>("/organizations", data),
};
