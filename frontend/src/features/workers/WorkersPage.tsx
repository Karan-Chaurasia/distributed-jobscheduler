import { useQuery } from "@tanstack/react-query";
import { workersApi } from "../../api/workers";
import { PageHeader } from "../../components/Layout";
import { Badge, Card, Spinner } from "../../components/ui";

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function WorkersPage() {
  const workers = useQuery({
    queryKey: ["workers"],
    queryFn: () => workersApi.findAll().then((r) => r.data.data),
    refetchInterval: 4000,
  });

  return (
    <div>
      <PageHeader title="Workers" subtitle="Registered workers, heartbeats and load" />
      <div className="p-8">
        <Card>
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-700">Worker fleet</h2>
          </div>
          {workers.isLoading ? (
            <Spinner />
          ) : workers.data && workers.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-6 py-3 font-medium">Hostname</th>
                    <th className="px-6 py-3 font-medium">Worker ID</th>
                    <th className="px-6 py-3 font-medium">IP</th>
                    <th className="px-6 py-3 font-medium">Load</th>
                    <th className="px-6 py-3 font-medium">Last heartbeat</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workers.data.map((w) => {
                    const pct = w.maxConcurrency
                      ? Math.min(100, (w.activeJobCount / w.maxConcurrency) * 100)
                      : 0;
                    return (
                      <tr key={w.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-800">{w.hostname}</td>
                        <td className="px-6 py-3 font-mono text-xs text-slate-400">
                          {w.workerId.slice(0, 8)}
                        </td>
                        <td className="px-6 py-3 text-slate-500">{w.ipAddress}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">
                              {w.activeJobCount}/{w.maxConcurrency}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-500">{timeAgo(w.lastHeartbeatAt)}</td>
                        <td className="px-6 py-3"><Badge status={w.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-6 py-8 text-sm text-slate-400">No workers registered.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
