# Architecture Documentation

## 1. Design Principles

- **Clean Architecture** — dependencies point inward; domain logic has zero framework dependencies
- **Feature-based packaging** — each feature is a self-contained vertical slice
- **SOLID** — single responsibility per class, interfaces for all services, constructor injection only
- **DTOs at boundaries** — JPA entities never leave the service layer
- **Centralized exception handling** — `GlobalExceptionHandler` translates domain exceptions to HTTP responses

---

## 2. Backend Package Structure

```
com.scheduler
├── DistributedJobSchedulerApplication.java
│
├── common/                        # Cross-cutting concerns
│   ├── audit/                     # BaseEntity, AuditConfig (JPA auditing)
│   ├── config/                    # SecurityConfig, RedisConfig, RabbitMQConfig,
│   │                              #   WebSocketConfig, OpenApiConfig
│   ├── exception/                 # DomainException hierarchy, GlobalExceptionHandler
│   ├── response/                  # ApiResponse<T>, PagedResponse<T>
│   ├── security/                  # JWT filter, token service (TODO)
│   └── util/                      # Shared utilities (TODO)
│
├── auth/                          # Authentication & token management
│   ├── controller/AuthController
│   ├── service/AuthService + AuthServiceImpl
│   └── dto/LoginRequest, RegisterRequest, AuthResponse, RefreshTokenRequest
│
├── users/                         # User management
│   ├── controller/UserController
│   ├── service/UserService + UserServiceImpl
│   ├── repository/UserRepository
│   ├── entity/User + enums/
│   ├── dto/UserDto, UpdateUserRequest
│   └── mapper/UserMapper
│
├── organization/                  # Organization management
│   ├── controller/OrganizationController
│   ├── service/OrganizationService + OrganizationServiceImpl
│   ├── repository/OrganizationRepository
│   ├── entity/Organization, OrganizationStatus
│   ├── dto/OrganizationDto, CreateOrganizationRequest
│   └── mapper/OrganizationMapper
│
├── project/                       # Project management
│   └── (same structure as organization)
│
├── queue/                         # Job queue management
│   └── (same structure, adds pause/resume)
│
├── jobs/                          # Job lifecycle
│   ├── entity/Job + enums/JobStatus, JobType
│   └── (submit, cancel, retry operations)
│
├── worker/                        # Worker registration & heartbeats
│   └── (register, heartbeat, dead worker detection)
│
├── scheduler/                     # Cron-driven dispatching
│   └── service/JobSchedulerServiceImpl  (@Scheduled methods)
│
├── retry/                         # Retry policy per queue
│   └── entity/RetryPolicy, BackoffStrategy
│
├── metrics/                       # Aggregated metrics
│   └── (job counts, worker stats per queue/project)
│
└── websocket/                     # Real-time push notifications
    └── service/WebSocketNotificationService
```

---

## 3. Data Flow

### Job Submission
```
Client → POST /api/jobs
  → JobController.submit()
  → JobServiceImpl.submit()
    → Validate queue exists & is ACTIVE
    → Persist Job (status=PENDING)
    → Publish message to RabbitMQ jobs.exchange
    → Update job status to QUEUED
  → Return JobDto
```

### Job Execution (Worker)
```
RabbitMQ → Worker consumes message
  → Worker updates job status to RUNNING
  → Worker sends heartbeat every 30s
  → On success: status=COMPLETED, notify via WebSocket
  → On failure: status=FAILED, increment attemptCount
    → If attemptCount < maxAttempts: re-queue with backoff delay
    → If attemptCount >= maxAttempts: status=DEAD, route to DLQ
```

### Scheduler Loop
```
@Scheduled(fixedDelay=5s)
  → Query PENDING jobs WHERE scheduledAt <= NOW()
  → Publish to RabbitMQ
  → Update status to QUEUED

@Scheduled(fixedDelay=10s)
  → Evaluate CRON jobs
  → Create Job instances for due cron expressions
  → Publish to RabbitMQ

@Scheduled(fixedDelay=30s)
  → Detect RUNNING jobs with no heartbeat > 90s
  → Mark as FAILED, trigger retry logic
```

---

## 4. Infrastructure

| Service    | Port  | Purpose                              |
|------------|-------|--------------------------------------|
| Backend    | 8080  | REST API + WebSocket                 |
| PostgreSQL | 5432  | Persistent job/worker metadata       |
| Redis      | 6379  | Distributed locks, token blacklist   |
| RabbitMQ   | 5672  | Job message broker                   |
| RabbitMQ   | 15672 | Management UI                        |
| Prometheus | 9090  | Metrics scraping                     |
| Grafana    | 3000  | Metrics dashboards                   |
| Frontend   | 5173  | React dev server                     |

---

## 5. RabbitMQ Topology

```
jobs.exchange (Direct)
  ├── jobs.default.routing-key  →  jobs.default.queue
  └── jobs.delayed.routing-key  →  jobs.delayed.queue

Both queues have:
  x-dead-letter-exchange    = jobs.dlx.exchange
  x-dead-letter-routing-key = jobs.dlq.queue

jobs.dlx.exchange (Direct)
  └── jobs.dlq.queue  (Dead Letter Queue)
```

---

## 6. Security

- Stateless JWT authentication (access + refresh tokens)
- Refresh tokens stored in Redis with TTL
- Token blacklisting on logout via Redis
- Method-level security with `@PreAuthorize`
- Roles: `ADMIN`, `ORG_OWNER`, `ORG_MEMBER`, `USER`

---

## 7. Feature Implementation Order (Suggested)

1. `auth` — JWT filter, login, register, refresh
2. `users` — profile management
3. `organization` + `project` — multi-tenancy
4. `queue` — queue CRUD + pause/resume
5. `jobs` — submit, cancel, retry + RabbitMQ publishing
6. `worker` — registration, heartbeat, dead detection
7. `scheduler` — cron dispatch, stalled job reaping
8. `retry` — backoff calculation, DLQ handling
9. `metrics` — aggregation + Micrometer counters
10. `websocket` — real-time job status push
