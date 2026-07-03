import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { metricsApi } from "../../api/metrics";
import { workersApi } from "../../api/workers";
import { PageHeader } from "../../components/Layout";
import { Card, StatCard, Spinner, Badge } from "../../components/ui";

// Neutral status colours for the chart (no dark blue / dark green fills).
const STATUS_COLOR: Record<string, string> = {
  PENDING: "#94a3b8",
  QUEUED: "#64748b",
  RUNNING: "#38bdf8",
  COMPLETED: "#34d399",
  FAILED: "#f87171",
  RETRYING: "#fbbf24",
  CANCELLED: "#cbd5e1",
  DEAD: "#fb7185",
};

export default function DashboardPage() {
  const metrics = useQuery({
    queryKey: ["metrics"],
    queryFn: () => metricsApi.overview().then((r) => r.data.data),
    refetchInterval: 5000,
  });

  const workers = useQuery({
    queryKey: ["workers"],
    queryFn: () => workersApi.findAll().then((r) => r.data.data),
    refetchInterval: 5000,
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Live view of throughput, queues and worker health"
      />
      <div className="space-y-6 p-8">
        {metrics.isLoading ? (
          <Spinner />
        ) : metrics.data ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total jobs" value={metrics.data.totalJobs} />
              <StatCard
                label="Completed"
                value={Math.round(metrics.data.completedTotal)}
                accent="text-emerald-600"
              />
              <StatCard
                label="Workers online"
                value={`${metrics.data.onlineWorkers}/${metrics.data.totalWorkers}`}
              />
              <StatCard
                label="Dead-letter queue"
                value={metrics.data.deadLetterDepth}
                accent={metrics.data.deadLetterDepth > 0 ? "text-rose-600" : "text-slate-900"}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="p-6 lg:col-span-2">
                <h2 className="text-sm font-semibold text-slate-700">Jobs by status</h2>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(metrics.data.jobsByStatus).map(([status, count]) => ({
                        status,
                        count,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="status"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "#f8fafc" }}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {Object.keys(metrics.data.jobsByStatus).map((status) => (
                          <Cell key={status} fill={STATUS_COLOR[status] ?? "#94a3b8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-sm font-semibold text-slate-700">Throughput</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <Row label="Submitted" value={Math.round(metrics.data.submittedTotal)} />
                  <Row label="Completed" value={Math.round(metrics.data.completedTotal)} />
                  <Row label="Failed" value={Math.round(metrics.data.failedTotal)} />
                  <Row label="Dead-lettered" value={Math.round(metrics.data.deadLetteredTotal)} />
                  <Row label="Queues" value={metrics.data.totalQueues} />
                </dl>
              </Card>
            </div>

            <Card>
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-700">Workers</h2>
              </div>
              {workers.data && workers.data.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {workers.data.map((w) => (
                    <div key={w.id} className="flex items-center justify-between px-6 py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-800">{w.hostname}</p>
                        <p className="text-xs text-slate-400">{w.workerId.slice(0, 8)}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <span className="text-xs text-slate-500">
                          {w.activeJobCount}/{w.maxConcurrency} active
                        </span>
                        <Badge status={w.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-6 py-6 text-sm text-slate-400">
                  No workers registered yet.
                </p>
              )}
            </Card>
          </>
        ) : (
          <p className="text-sm text-slate-500">Could not load metrics.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
