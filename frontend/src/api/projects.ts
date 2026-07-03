import apiClient from "./client";
import type { ApiResponse, PagedResponse, Project } from "../types";

export const projectsApi = {
  findByOrganization: (organizationId: string, page = 0, size = 50) =>
    apiClient.get<ApiResponse<PagedResponse<Project>>>("/projects", {
      params: { organizationId, page, size },
    }),

  create: (data: {
    organizationId: string;
    ownerId: string;
    name: string;
    slug: string;
    description?: string;
  }) => apiClient.post<ApiResponse<Project>>("/projects", data),
};
