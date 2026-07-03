# Architecture Documentation

## 1. Design Principles

- **Clean, feature-based packaging** — each domain (auth, jobs, queue, worker, …) is a
  self-contained vertical slice: controller → service → repository → entity/dto/mapper.
- **Interfaces + constructor injection** — every service has an interface; no field injection.
- **DTOs at boundaries** — JPA entities never leave the service layer; MapStruct maps to DTOs.
- **Centralized error handling** — a `DomainException` hierarchy is translated to HTTP
  responses by `GlobalExceptionHandler`, wrapped in a uniform `ApiResponse<T>` envelope.
- **The database is the coordinator** — job state and the "queue" both live in Postgres.
  Workers claim work with `SELECT … FOR UPDATE SKIP LOCKED`, which gives exactly-once
  hand-off across any number of workers **without** a separate message broker.

---

## 2. High-Level Architecture

```
                 ┌────────────────────────┐
                 │  React + TypeScript UI  │   (Vite dev server :5173, proxies /api)
                 └───────────┬────────────┘
                             │ REST (JWT)
                             ▼
                 ┌────────────────────────┐
                 │   Spring Boot service   │
                 │  ┌──────────────────┐   │
                 │  │  Control plane   │   │  REST API: auth, orgs, projects,
                 │  │  (controllers)   │   │  queues, jobs, workers, metrics
                 │  ├──────────────────┤   │
                 │  │  Scheduler loops │   │  @Scheduled: promote due jobs,
                 │  │                  │   │  materialise cron, reap stalled
                 │  ├──────────────────┤   │
                 │  │ Embedded worker  │   │  poll → claim (SKIP LOCKED) →
                 │  │ (thread pool)    │   │  execute → complete/retry/DLQ
                 │  └──────────────────┘   │
                 └─────┬─────────────┬─────┘
                       │ JDBC/JPA    │ Redis
                       ▼             ▼
              ┌────────────────┐  ┌──────────────────────┐
              │   PostgreSQL   │  │        Redis         │
              │  jobs (=queue) │  │  JWT blacklist,      │
              │  executions    │  │  response cache      │
              │  workers, DLQ  │  └──────────────────────┘
              └────────────────┘
```

The worker is **embedded** in the same Spring Boot process by default (`scheduler.worker.enabled=true`).
Because claiming is done atomically in the database, you scale out simply by starting more
instances of the same jar — they compete for jobs safely. Set `scheduler.worker.enabled=false`
to run an API-only (control-plane) node.

---

## 3. Backend Package Structure

```
com.scheduler
├── common/          # BaseEntity, SecurityConfig/JWT, exception handling,
│                    #   ApiResponse/PagedResponse, JobMetrics, SchedulingConfig
├── auth/            # register / login / refresh (rotation) / logout (blacklist)
├── users/           # user CRUD
├── organization/    # org CRUD + owner membership
├── project/         # project CRUD (org-scoped)
├── queue/           # queue CRUD + pause/resume + concurrency/retry config
├── retry/           # RetryPolicy CRUD + backoff calculation (FIXED/LINEAR/EXPONENTIAL)
├── jobs/            # Job lifecycle
│   ├── service/JobServiceImpl          # submit / cancel / retry / executions / DLQ
│   └── service/JobExecutionService     # atomic claim + success/failure transitions
├── worker/
│   ├── service/WorkerServiceImpl       # register / heartbeat / deregister / dead detection
│   └── runtime/EmbeddedWorker          # poll loop, executor pool, graceful shutdown
├── scheduler/       # @Scheduled dispatch loops (due, cron, reaper)
└── metrics/         # aggregated dashboard metrics endpoint
```

---

## 4. Job Lifecycle

```
 submit ──▶ QUEUED ──▶ (worker claims) ──▶ RUNNING ──▶ COMPLETED
   │           ▲                                  │
   │ delayed/  │ scheduler promotes when due      │ on failure
   ▼ scheduled │                                  ▼
 PENDING ──────┘                     attempts left?  ── yes ─▶ RETRYING ─(backoff elapsed)─┐
                                             │ no                                          │
                                             ▼                                             │
                                           DEAD  ──▶ dead_letter_entries          (scheduler promotes)
                                                                                           │
 any non-terminal state ──▶ CANCELLED                     QUEUED ◀───────────────────────┘
```

### Atomic claim (the core of the concurrency model)

```sql
SELECT j.* FROM jobs j
JOIN job_queues q ON q.id = j.queue_id
WHERE j.status = 'QUEUED'
  AND j.scheduled_at <= now()
  AND q.status = 'ACTIVE'                                  -- pause/resume
  AND (SELECT count(*) FROM jobs r
         WHERE r.queue_id = j.queue_id
           AND r.status = 'RUNNING') < q.concurrency       -- per-queue concurrency limit
ORDER BY j.priority DESC, j.scheduled_at ASC               -- priority + FIFO
LIMIT :limit
FOR UPDATE OF j SKIP LOCKED;                               -- no two workers get the same job
```

The worker flips the returned rows to `RUNNING` inside the *same* transaction, so the lock
is released holding the new state. Job execution then runs on a bounded thread pool
**outside** the transaction — a slow job never holds a row lock or DB connection.

### Scheduler loops (`scheduler` package)

| Loop | Default cadence | Responsibility |
|------|-----------------|----------------|
| `dispatchDueJobs` | 5s  | `UPDATE … SET status='QUEUED'` for PENDING/RETRYING jobs whose `scheduled_at <= now()` |
| `dispatchCronJobs` | 10s | materialise concrete `Job` rows from due `scheduled_jobs` (cron) definitions |
| `reapStalledJobs`  | 30s | mark workers that missed heartbeats as DEAD; requeue the RUNNING jobs they held |

---

## 5. Reliability & Concurrency

- **No duplicate execution** — `FOR UPDATE SKIP LOCKED` guarantees a QUEUED row is handed to
  exactly one worker.
- **Crash recovery** — the reaper requeues jobs orphaned by a worker that stopped
  heart-beating, so no work is silently lost.
- **Backoff & DLQ** — failures are retried with FIXED / LINEAR / EXPONENTIAL backoff (with
  optional jitter) until `max_attempts`, after which the job is dead-lettered for inspection/replay.
- **Graceful shutdown** — on SIGTERM the worker stops claiming, drains in-flight jobs
  (up to 30s), then deregisters.
- **Idempotent transitions** — each state change is a short transaction reloading the row by id.

---

## 6. Infrastructure

| Service    | Port | Purpose |
|------------|------|---------|
| Backend    | 8080 | REST API + embedded worker + `/actuator/prometheus` |
| PostgreSQL | 5432 | System of record **and** the job queue |
| Redis      | 6379 | JWT blacklist + response cache |
| Frontend   | 5173 | React (Vite) dev server |

No message broker is required. Metrics are exposed via Micrometer at
`/actuator/prometheus` and aggregated for the dashboard at `/api/metrics/overview`.

---

## 7. Security

- Stateless JWT (access + refresh) with refresh-token rotation.
- Logout blacklists the access token (Redis); password change revokes all sessions.
- Role-based access control at the URL and method level.
  Roles: `ADMIN`, `PROJECT_ADMIN`, `DEVELOPER`, `VIEWER`.
- The first user to register is bootstrapped as `ADMIN`; subsequent users are `DEVELOPER`.
