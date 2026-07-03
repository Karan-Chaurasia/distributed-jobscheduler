import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { organizationsApi } from "../../api/organizations";
import { projectsApi } from "../../api/projects";
import { queuesApi } from "../../api/queues";
import { jobsApi } from "../../api/jobs";
import { PageHeader } from "../../components/Layout";
import { Badge, Button, Card, Field, Spinner, inputClass } from "../../components/ui";
import type { Job, JobType } from "../../types";

const JOB_TYPES: JobType[] = ["IMMEDIATE", "DELAYED", "SCHEDULED", "CRON", "BATCH"];

export default function JobsPage() {
  const qc = useQueryClient();
  const [orgId, setOrgId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [queueId, setQueueId] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "IMMEDIATE" as JobType,
    payload: '{"action":"succeed"}',
    cronExpression: "",
    scheduledAt: "",
    priority: 0,
    maxAttempts: 3,
  });

  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsApi.findAll().then((r) => r.data.data.content),
  });
  const projects = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => projectsApi.findByOrganization(orgId).then((r) => r.data.data.content),
    enabled: !!orgId,
  });
  const queues = useQuery({
    queryKey: ["queues", projectId],
    queryFn: () => queuesApi.findByProject(projectId).then((r) => r.data.data.content),
    enabled: !!projectId,
  });
  const jobs = useQuery({
    queryKey: ["jobs", queueId],
    queryFn: () => jobsApi.findByQueue(queueId, 0, 50).then((r) => r.data.data.content),
    enabled: !!queueId,
    refetchInterval: 3000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["jobs", queueId] });

  const submitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueId) return;
    let payload: Record<string, unknown> | undefined;
    try {
      payload = form.payload.trim() ? JSON.parse(form.payload) : undefined;
    } catch {
      toast.error("Payload is not valid JSON");
      return;
    }
    try {
      await jobsApi.submit({
        queueId,
        name: form.name,
        type: form.type,
        payload,
        cronExpression: form.type === "CRON" ? form.cronExpression : undefined,
        scheduledAt:
          form.type === "DELAYED" || form.type === "SCHEDULED"
            ? new Date(form.scheduledAt).toISOString()
            : undefined,
        priority: form.priority,
        maxAttempts: form.maxAttempts,
      });
      toast.success("Job submitted");
      setForm({ ...form, name: "" });
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to submit job");
    }
  };

  const action = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Action failed");
    }
  };

  return (
    <div>
      <PageHeader title="Jobs" subtitle="Submit, inspect and replay jobs; view execution logs" />
      <div className="space-y-6 p-8">
        <Card className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Organization">
              <select
                className={inputClass}
                value={orgId}
                onChange={(e) => {
                  setOrgId(e.target.value);
                  setProjectId("");
                  setQueueId("");
                }}
              >
                <option value="">Select…</option>
                {orgs.data?.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Project">
              <select
                className={inputClass}
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setQueueId("");
                }}
                disabled={!orgId}
              >
                <option value="">Select…</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Queue">
              <select
                className={inputClass}
                value={queueId}
                onChange={(e) => setQueueId(e.target.value)}
                disabled={!projectId}
              >
                <option value="">Select…</option>
                {queues.data?.map((q) => (
                  <option key={q.id} value={q.id}>{q.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        {queueId && (
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-700">Submit job</h2>
            <form onSubmit={submitJob} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Type">
                <select
                  className={inputClass}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as JobType })}
                >
                  {JOB_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <input
                  type="number"
                  className={inputClass}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                />
              </Field>
              <Field label="Max attempts">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.maxAttempts}
                  onChange={(e) => setForm({ ...form, maxAttempts: Number(e.target.value) })}
                />
              </Field>

              {form.type === "CRON" && (
                <Field label="Cron expression (6-field)">
                  <input
                    className={inputClass}
                    placeholder="0 */1 * * * *"
                    value={form.cronExpression}
                    onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
                  />
                </Field>
              )}
              {(form.type === "DELAYED" || form.type === "SCHEDULED") && (
                <Field label="Run at">
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  />
                </Field>
              )}

              <div className="sm:col-span-2 lg:col-span-4">
                <Field label="Payload (JSON) — try {&quot;action&quot;:&quot;flaky&quot;,&quot;failRate&quot;:0.5} or {&quot;action&quot;:&quot;fail&quot;}">
                  <textarea
                    rows={2}
                    className={`${inputClass} font-mono`}
                    value={form.payload}
                    onChange={(e) => setForm({ ...form, payload: e.target.value })}
                  />
                </Field>
              </div>
              <div>
                <Button type="submit">Submit job</Button>
              </div>
            </form>
          </Card>
        )}

        <Card>
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-700">Job explorer</h2>
          </div>
          {!queueId ? (
            <p className="px-6 py-8 text-sm text-slate-400">Select a queue to explore its jobs.</p>
          ) : jobs.isLoading ? (
            <Spinner />
          ) : jobs.data && jobs.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Attempts</th>
                    <th className="px-6 py-3 font-medium">Priority</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.data.map((j) => (
                    <tr
                      key={j.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedJob(j)}
                    >
                      <td className="px-6 py-3 font-medium text-slate-800">{j.name}</td>
                      <td className="px-6 py-3 text-slate-500">{j.type}</td>
                      <td className="px-6 py-3"><Badge status={j.status} /></td>
                      <td className="px-6 py-3 text-slate-600">
                        {j.attemptCount}/{j.maxAttempts}
                      </td>
                      <td className="px-6 py-3 text-slate-600">{j.priority}</td>
                      <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => action(() => jobsApi.retry(j.id), "Job re-queued")}>
                            Retry
                          </Button>
                          <Button variant="ghost" onClick={() => action(() => jobsApi.cancel(j.id), "Job cancelled")}>
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-6 py-8 text-sm text-slate-400">No jobs yet — submit one above.</p>
          )}
        </Card>
      </div>

      {selectedJob && (
        <JobDetail job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}

function JobDetail({ job, onClose }: { job: Job; onClose: () => void }) {
  const executions = useQuery({
    queryKey: ["executions", job.id],
    queryFn: () => jobsApi.executions(job.id).then((r) => r.data.data),
    refetchInterval: 3000,
  });

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-slate-900/20" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{job.name}</h3>
            <p className="text-xs text-slate-400">{job.id}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Type" value={job.type} />
            <Info label="Status" value={<Badge status={job.status} />} />
            <Info label="Attempts" value={`${job.attemptCount}/${job.maxAttempts}`} />
            <Info label="Priority" value={String(job.priority)} />
          </div>

          {job.lastError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {job.lastError}
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Execution log</h4>
            {executions.isLoading ? (
              <Spinner />
            ) : executions.data && executions.data.length > 0 ? (
              <div className="space-y-2">
                {executions.data.map((ex) => (
                  <div key={ex.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">Attempt #{ex.attemptNumber}</span>
                      <Badge status={ex.status} />
                    </div>
                    <div className="mt-1 text-slate-500">
                      {ex.workerHostname && <span>worker: {ex.workerHostname} · </span>}
                      {ex.durationMs != null && <span>{ex.durationMs} ms</span>}
                    </div>
                    {ex.errorMessage && (
                      <p className="mt-1 font-mono text-red-600">{ex.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No executions recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-slate-800">{value}</p>
    </div>
  );
}
