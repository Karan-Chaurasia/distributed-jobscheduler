import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { organizationsApi } from "../../api/organizations";
import { projectsApi } from "../../api/projects";
import { PageHeader } from "../../components/Layout";
import { Button, Card, Field, Spinner, inputClass } from "../../components/ui";
import { getUser } from "../../lib/auth";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [orgForm, setOrgForm] = useState({ name: "", description: "" });
  const [projForm, setProjForm] = useState({ name: "", description: "" });

  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsApi.findAll().then((r) => r.data.data.content),
  });

  const projects = useQuery({
    queryKey: ["projects", selectedOrg],
    queryFn: () =>
      projectsApi.findByOrganization(selectedOrg).then((r) => r.data.data.content),
    enabled: !!selectedOrg,
  });

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await organizationsApi.create({
        name: orgForm.name,
        slug: slugify(orgForm.name),
        description: orgForm.description,
      });
      toast.success("Organization created");
      setOrgForm({ name: "", description: "" });
      qc.invalidateQueries({ queryKey: ["organizations"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create organization");
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = getUser();
    if (!selectedOrg || !user) return;
    try {
      await projectsApi.create({
        organizationId: selectedOrg,
        ownerId: user.id,
        name: projForm.name,
        slug: slugify(projForm.name),
        description: projForm.description,
      });
      toast.success("Project created");
      setProjForm({ name: "", description: "" });
      qc.invalidateQueries({ queryKey: ["projects", selectedOrg] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create project");
    }
  };

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Organizations own projects; projects own queues"
      />
      <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-3">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-700">New organization</h2>
            <form onSubmit={createOrg} className="mt-4 space-y-3">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Description">
                <input
                  className={inputClass}
                  value={orgForm.description}
                  onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                />
              </Field>
              <Button type="submit" className="w-full">Create organization</Button>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-700">New project</h2>
            <form onSubmit={createProject} className="mt-4 space-y-3">
              <Field label="Organization">
                <select
                  className={inputClass}
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {orgs.data?.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Name">
                <input
                  className={inputClass}
                  value={projForm.name}
                  onChange={(e) => setProjForm({ ...projForm, name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Description">
                <input
                  className={inputClass}
                  value={projForm.description}
                  onChange={(e) => setProjForm({ ...projForm, description: e.target.value })}
                />
              </Field>
              <Button type="submit" className="w-full" disabled={!selectedOrg}>
                Create project
              </Button>
            </form>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Projects {selectedOrg && orgs.data ? `· ${orgs.data.find((o) => o.id === selectedOrg)?.name}` : ""}
            </h2>
          </div>
          {!selectedOrg ? (
            <p className="px-6 py-8 text-sm text-slate-400">
              Select an organization to view its projects.
            </p>
          ) : projects.isLoading ? (
            <Spinner />
          ) : projects.data && projects.data.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Slug</th>
                  <th className="px-6 py-3 font-medium">Project ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.data.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-6 py-3 text-slate-500">{p.slug}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-400">{p.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-6 py-8 text-sm text-slate-400">
              No projects yet — create one on the left.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
