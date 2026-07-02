export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  timestamp: string;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export type JobStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING"
  | "CANCELLED"
  | "DEAD";

export type JobType = "IMMEDIATE" | "DELAYED" | "SCHEDULED" | "CRON" | "BATCH";

export interface Job {
  id: string;
  queueId: string;
  name: string;
  type: JobType;
  status: JobStatus;
  payload?: Record<string, unknown>;
  cronExpression?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string;
  priority: number;
  createdAt: string;
}

export interface Queue {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  concurrency: number;
  maxRetries: number;
  status: "ACTIVE" | "PAUSED" | "DELETED";
  createdAt: string;
}

export interface Worker {
  id: string;
  workerId: string;
  hostname: string;
  ipAddress: string;
  status: "ONLINE" | "BUSY" | "OFFLINE" | "DEAD";
  lastHeartbeatAt?: string;
  activeJobCount: number;
  maxConcurrency: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  createdAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  createdAt: string;
}
