# Design Decisions & Trade-offs

This document records the major engineering choices and why they were made. The guiding
priority was *engineering quality, reliability and concurrency correctness* over feature count.

---

## 1. PostgreSQL `SKIP LOCKED` as the queue — no message broker

**Decision.** Jobs live in the `jobs` table and workers claim them with
`SELECT … FOR UPDATE SKIP LOCKED`, rather than publishing to RabbitMQ/Kafka.

**Why.**
- The assignment explicitly asks for *"a worker service that polls queues and atomically
  claims jobs."* `SKIP LOCKED` is the textbook way to do exactly that, and it makes the
  atomicity guarantee visible in one SQL statement.
- One fewer stateful system to run, secure and reason about. The queue and the system of
  record can't drift out of sync because they're the same transaction.
- Postgres gives us priority ordering, per-queue concurrency limits, and pause/resume as
  plain `WHERE` clauses — no broker-specific plugins.

**Trade-off.** A broker scales to higher throughput and offers push delivery. At the scale
this project targets (and for clarity of the concurrency story) polling every ~2s is more than
adequate, and the design note above documents how one would swap in a broker later.

---

## 2. Embedded worker, horizontally scalable

**Decision.** The worker runs in-process in the Spring Boot app (toggle
`scheduler.worker.enabled`), using a bounded `ThreadPoolExecutor`.

**Why.** Simplest thing that is still *correct under concurrency*: because claiming is atomic
in the DB, running N copies of the jar is automatically safe and load-balanced — the same code
path proves out single-node and multi-node behaviour. Separating the worker into its own
deployable is a packaging change, not an architecture change.

**Trade-off.** API and execution share a JVM by default. For isolation you set
`WORKER_ENABLED=false` on API nodes and `true` on dedicated worker nodes — same jar, different config.

---

## 3. Claim inside a transaction, execute outside it

**Decision.** The claim + `RUNNING` transition happen in one short transaction; the actual job
payload runs on a worker thread with no open transaction, and completion is a second short
transaction that reloads the row by id.

**Why.** A long-running job must never hold a row lock or a pooled DB connection. This keeps
the connection pool free and lock windows tiny, which is what lets many jobs run concurrently.

---

## 4. Retry state machine and backoff

**Decision.** Failures increment `attempt_count`; if attempts remain the job becomes
`RETRYING` with `scheduled_at = now + backoff`, and the dispatcher promotes it back to `QUEUED`
when due. Exhausted jobs become `DEAD` and get a `dead_letter_entries` row.

Backoff strategies: `FIXED`, `LINEAR`, `EXPONENTIAL`, each clamped to `max_delay` with optional
±20% jitter to avoid thundering-herd retries.

**Why.** Reusing the existing scheduled-dispatch path for retries means one promotion mechanism
handles delayed jobs, scheduled jobs and retries alike. Jitter and clamping are small touches
that matter under real failure storms.

---

## 5. Crash recovery via heartbeats + reaper

**Decision.** Workers heartbeat every ~15s. A reaper loop marks workers silent past a timeout
as `DEAD` and requeues the `RUNNING` jobs they were holding (marking the stuck execution
`TIMED_OUT`).

**Why.** Without this, a worker crash would strand its in-flight jobs in `RUNNING` forever.
This is the difference between "runs on the happy path" and "reliable."

**Trade-off.** Requeuing a job whose worker died but which actually finished could re-run it.
Handlers are therefore expected to be idempotent — the standard at-least-once contract.

---

## 6. Database schema

**Decision.** Fully normalized relational schema with a dedicated append-only
`job_executions` table (one row per attempt) separate from the mutable `jobs` row, plus
`worker_heartbeats`, `dead_letter_entries`, `scheduled_jobs` and `audit_logs`.

**Why.**
- Separating per-attempt execution facts from the job keeps `jobs` in 3NF and gives a complete
  audit trail (duration, worker, error) for every attempt.
- Indexing is workload-driven: composite/partial indexes back the exact hot queries — e.g.
  `(queue_id, priority DESC, scheduled_at ASC) WHERE status IN ('PENDING','QUEUED')` for
  claiming, `WHERE status='PENDING'` partial index for dispatch.
- Cascade rules mirror ownership (`org → project → queue → job → execution`) so deletes are
  clean; the DLQ denormalizes `queue_id` to allow per-queue browsing without a join.

See [ER_DIAGRAM.md](ER_DIAGRAM.md) for the full model.

---

## 7. Idempotent, uniform API surface

**Decision.** Every response is wrapped in `ApiResponse<T>`; lists use `PagedResponse<T>`;
domain errors flow through `GlobalExceptionHandler` with proper HTTP status codes. DTOs (Java
records) are mapped from entities by MapStruct so entities never leak.

**Why.** Predictable envelopes and error shapes make the frontend and any API client simpler
and the contract self-consistent.

---

## 8. Security & bootstrap

**Decision.** Stateless JWT with refresh-token rotation; logout blacklists the token in Redis;
RBAC at URL + method level. The first user to register becomes `ADMIN`.

**Why.** The bootstrap-admin rule makes the system usable out of the box without seeding a
hashed password into a migration, while still exercising the full RBAC model for later users.

---

## What was intentionally kept simple

To stay focused on core engineering quality within the timeframe, these were treated as
out-of-scope (the architecture leaves room for each): a broker-backed transport, WebSocket push
(the dashboard uses short-interval polling instead), queue sharding, and distributed rate
limiting. Each is a localized addition rather than a rewrite.
