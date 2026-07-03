import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { organizationsApi } from "../../api/organizations";
import { projectsApi } from "../../api/projects";
import { queuesApi } from "../../api/queues";
import { PageHeader } from "../../components/Layout";
import { Badge, Button, Card, Field, Spinner, inputClass } from "../../components/ui";

export default function QueuesPage() {
  const qc = useQueryClient();
  const [orgId, setOrgId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [form, setForm] = useState({ name: "", description: "", concurrency: 5, maxRetries: 3 });

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
    refetchInterval: 5000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["queues", projectId] });

  const createQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    try {
      await queuesApi.create({ projectId, ...form } as any);
      toast.success("Queue created");
      setForm({ name: "", description: "", concurrency: 5, maxRetries: 3 });
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create queue");
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
      <PageHeader
        title="Queues"
        subtitle="Configure concurrency, retries and pause/resume delivery"
      />
      <div className="space-y-6 p-8">
        <Card className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Organization">
              <select
                className={inputClass}
                value={orgId}
                onChange={(e) => {
                  setOrgId(e.target.value);
                  setProjectId("");
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
                onChange={(e) => setProjectId(e.target.value)}
                disabled={!orgId}
              >
                <option value="">Select…</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        {projectId && (
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-700">New queue</h2>
            <form onSubmit={createQueue} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Concurrency">
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={inputClass}
                  value={form.concurrency}
                  onChange={(e) => setForm({ ...form, concurrency: Number(e.target.value) })}
                />
              </Field>
              <Field label="Max retries">
                <input
                  type="number"
                  min={0}
                  max={10}
                  className={inputClass}
                  value={form.maxRetries}
                  onChange={(e) => setForm({ ...form, maxRetries: Number(e.target.value) })}
                />
              </Field>
              <div className="flex items-end">
                <Button type="submit" className="w-full">Create queue</Button>
              </div>
            </form>
          </Card>
        )}

        <Card>
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-700">Queues</h2>
          </div>
          {!projectId ? (
            <p className="px-6 py-8 text-sm text-slate-400">Select a project to view its queues.</p>
          ) : queues.isLoading ? (
            <Spinner />
          ) : queues.data && queues.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Concurrency</th>
                    <th className="px-6 py-3 font-medium">Max retries</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Queue ID</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queues.data.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-800">{q.name}</td>
                      <td className="px-6 py-3 text-slate-600">{q.concurrency}</td>
                      <td className="px-6 py-3 text-slate-600">{q.maxRetries}</td>
                      <td className="px-6 py-3"><Badge status={q.status} /></td>
                      <td className="px-6 py-3 font-mono text-xs text-slate-400">{q.id}</td>
                      <td className="px-6 py-3">
                        <div className="flex justify-end gap-2">
                          {q.status === "ACTIVE" ? (
                            <Button
                              variant="secondary"
                              onClick={() => action(() => queuesApi.pause(q.id), "Queue paused")}
                            >
                              Pause
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              onClick={() => action(() => queuesApi.resume(q.id), "Queue resumed")}
                            >
                              Resume
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            onClick={() => action(() => queuesApi.delete(q.id), "Queue deleted")}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-6 py-8 text-sm text-slate-400">No queues yet — create one above.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
