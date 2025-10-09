import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase, hasSupabaseEnv } from "@/utils/supabaseClient";
import type { ChittoorProject, ChitoorProjectRecord } from "@shared/api";
import { format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

type ApprovalFilter = "all" | "pending" | "approved" | "rejected";
type DashboardTab = "approvals" | "projects" | "analytics";

const approvalFilterOptions: { key: ApprovalFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const tabOptions: { key: DashboardTab; label: string }[] = [
  { key: "approvals", label: "CRM Approvals" },
  { key: "projects", label: "Chittoor Projects" },
  { key: "analytics", label: "Analytics" },
];

export default function Index() {
  const navigate = useNavigate();
  const hasKeys = hasSupabaseEnv;
  const [activeTab, setActiveTab] = useState<DashboardTab>("approvals");

  const [approvals, setApprovals] = useState<ChittoorProject[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApprovalFilter>("all");

  const [projects, setProjects] = useState<ChitoorProjectRecord[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectsFetched, setProjectsFetched] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    if (!hasSupabaseEnv) {
      setApprovalsError(
        "Supabase not configured. Click Open MCP popover and connect to Supabase.",
      );
      return;
    }

    try {
      setApprovalsLoading(true);
      setApprovalsError(null);
      const { data, error } = await supabase
        .from("chittoor_project_approvals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setApprovals((data ?? []) as ChittoorProject[]);
    } catch (e: any) {
      setApprovalsError(e.message || "Failed to load projects");
    } finally {
      setApprovalsLoading(false);
    }
  }, []);

  const fetchChittoorProjects = useCallback(async () => {
    if (!hasSupabaseEnv) {
      setProjectsError(
        "Supabase not configured. Click Open MCP popover and connect to Supabase.",
      );
      return;
    }

    try {
      setProjectsLoading(true);
      setProjectsError(null);
      const { data, error } = await supabase
        .from("chitoor_projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProjects((data ?? []) as ChitoorProjectRecord[]);
    } catch (e: any) {
      setProjectsError(e.message || "Failed to load Chittoor projects");
    } finally {
      setProjectsLoading(false);
      setProjectsFetched(true);
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    void fetchApprovals();
  }, [fetchApprovals]);

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    const channel = supabase
      .channel("chittoor-approvals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chittoor_project_approvals" },
        (payload: any) => {
          setApprovals((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as ChittoorProject, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((p) =>
                p.id === (payload.new as ChittoorProject).id
                  ? { ...p, ...(payload.new as ChittoorProject) }
                  : p,
              );
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((p) => p.id !== (payload.old as ChittoorProject).id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseEnv || projectsFetched) return;
    if (activeTab === "projects" || activeTab === "analytics") {
      void fetchChittoorProjects();
    }
  }, [activeTab, fetchChittoorProjects, projectsFetched]);

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId(null);
      return;
    }
    const fallbackId = getProjectId(projects[0]);
    if (
      !selectedProjectId ||
      !projects.some((p) => getProjectId(p) === selectedProjectId)
    ) {
      setSelectedProjectId(fallbackId);
    }
  }, [projects, selectedProjectId]);

  const statusCounts = useMemo(() => {
    const counts: Record<ApprovalFilter, number> = {
      all: approvals.length,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    for (const p of approvals) {
      counts[p.approval_status] = (counts[p.approval_status] ?? 0) + 1;
    }
    counts.all = approvals.length;
    return counts;
  }, [approvals]);

  const filteredApprovals = useMemo(() => {
    if (filter === "all") return approvals;
    return approvals.filter((p) => p.approval_status === filter);
  }, [approvals, filter]);

  const projectsSummary = useMemo(() => {
    const summary = { total: projects.length, active: 0, completed: 0 };
    for (const project of projects) {
      const status = deriveProjectStatus(project);
      if (status === "active") summary.active += 1;
      else if (status === "completed") summary.completed += 1;
    }
    return summary;
  }, [projects]);

  const selectedProject = useMemo(() => {
    if (!projects.length) return null;
    const targetId = selectedProjectId ?? getProjectId(projects[0]);
    return projects.find((p) => getProjectId(p) === targetId) ?? null;
  }, [projects, selectedProjectId]);

  const analyticsData = useMemo(
    () => buildMonthlyAnalytics(approvals, projects),
    [approvals, projects],
  );

  const handleApprovalDelete = useCallback(
    async (id: string) => {
      if (!hasSupabaseEnv) {
        alert(
          "Supabase not configured. Click Open MCP popover and connect to Supabase.",
        );
        return;
      }
      const { error } = await supabase
        .from("chittoor_project_approvals")
        .delete()
        .eq("id", id);
      if (error) {
        alert(error.message);
        return;
      }
      setApprovals((prev) => prev.filter((project) => project.id !== id));
    },
    [setApprovals],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
      <div className="container py-10">
        <header className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg border border-emerald-200 bg-white/80 px-3 py-2 text-emerald-800 transition hover:bg-emerald-50"
            >
              Back
            </button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-emerald-900 md:text-4xl">
                Chittoor Projects
              </h1>
              <p className="mt-2 text-emerald-700/80">
                Track project details, request payments, and view CRM approvals in real time.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fetchApprovals()}
              disabled={!hasKeys}
              className="inline-flex items-center rounded-lg border border-emerald-200 px-4 py-2 text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh Approvals
            </button>
            <button
              onClick={() => fetchChittoorProjects()}
              disabled={!hasKeys}
              className="inline-flex items-center rounded-lg border border-emerald-200 px-4 py-2 text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh Projects
            </button>
            <Link
              to="/projects/new"
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-white shadow transition-colors hover:bg-emerald-700"
            >
              + New Project
            </Link>
          </div>
        </header>

        {!hasKeys && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <p className="font-semibold">Supabase not configured</p>
            <p className="mt-1 text-sm">
              Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. You can connect Supabase via MCP. Click
              {" "}
              <a className="underline" href="#open-mcp-popover">
                Open MCP popover
              </a>{" "}
              then Connect to Supabase.
            </p>
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as DashboardTab)}
          className="space-y-6"
        >
          <TabsList className="bg-white/60 backdrop-blur">
            {tabOptions.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="approvals">
            <ApprovalsTab
              approvals={filteredApprovals}
              statusCounts={statusCounts}
              filter={filter}
              onFilterChange={setFilter}
              loading={approvalsLoading}
              error={approvalsError}
              onDelete={handleApprovalDelete}
            />
          </TabsContent>

          <TabsContent value="projects">
            <ProjectsTab
              projects={projects}
              loading={projectsLoading}
              error={projectsError}
              summary={projectsSummary}
              selectedProjectId={selectedProjectId}
              onSelect={setSelectedProjectId}
              selectedProject={selectedProject}
              canRefresh={hasKeys}
              onRefresh={fetchChittoorProjects}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab data={analyticsData} loading={approvalsLoading || projectsLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

interface ApprovalsTabProps {
  approvals: ChittoorProject[];
  statusCounts: Record<ApprovalFilter, number>;
  filter: ApprovalFilter;
  onFilterChange: (filter: ApprovalFilter) => void;
  loading: boolean;
  error: string | null;
  onDelete: (id: string) => Promise<void> | void;
}

function ApprovalsTab({
  approvals,
  statusCounts,
  filter,
  onFilterChange,
  loading,
  error,
  onDelete,
}: ApprovalsTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {approvalFilterOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => onFilterChange(option.key)}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              filter === option.key
                ? "border-emerald-700 bg-emerald-600 text-white"
                : "border-emerald-200 bg-white/70 backdrop-blur hover:bg-white"
            }`}
          >
            <div className="text-sm opacity-80">{option.label}</div>
            <div className="text-2xl font-bold">
              {statusCounts[option.key] ?? 0}
            </div>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-emerald-50 text-emerald-900">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Project</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Capacity (kW)</th>
                <th className="px-4 py-3 text-left font-semibold">Location</th>
                <th className="px-4 py-3 text-left font-semibold">Power Bill #</th>
                <th className="px-4 py-3 text-left font-semibold">Cost</th>
                <th className="px-4 py-3 text-left font-semibold">Site Visit</th>
                <th className="px-4 py-3 text-left font-semibold">Payment</th>
                <th className="px-4 py-3 text-left font-semibold">Approval</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-emerald-700" colSpan={10}>
                    Loading projects…
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td className="px-4 py-6 text-center text-red-600" colSpan={10}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && approvals.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-emerald-700" colSpan={10}>
                    No projects yet. Create your first project.
                  </td>
                </tr>
              )}
              {approvals.map((p) => (
                <tr key={p.id} className="border-t border-emerald-100">
                  <td className="px-4 py-3 font-medium text-emerald-900">
                    <Link to={`/projects/${p.id}`}>{p.project_name}</Link>
                  </td>
                  <td className="px-4 py-3 text-emerald-800">
                    {p.date ? format(new Date(p.date), "dd MMM yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 text-emerald-800">
                    {p.capacity_kw ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-emerald-800">{p.location ?? "—"}</td>
                  <td className="px-4 py-3 text-emerald-800">
                    {p.power_bill_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-emerald-800">
                    {p.project_cost ? `₹${p.project_cost.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-emerald-800">
                    {p.site_visit_status ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-emerald-800">
                    {p.payment_amount ? `₹${p.payment_amount.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        p.approval_status === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : p.approval_status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {p.approval_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        to={`/projects/${p.id}/edit`}
                        className="rounded-md border border-emerald-200 px-2 py-1 text-emerald-800 hover:bg-emerald-50"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this project?")) return;
                          await onDelete(p.id);
                        }}
                        className="rounded-md border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-emerald-800/80">
        Approval status is synced from crm.axisogreen.in via shared Supabase. This app shows latest status and details.
      </p>
    </div>
  );
}

interface ProjectsTabProps {
  projects: ChitoorProjectRecord[];
  summary: { total: number; active: number; completed: number };
  loading: boolean;
  error: string | null;
  selectedProjectId: string | null;
  onSelect: (id: string | null) => void;
  selectedProject: ChitoorProjectRecord | null;
  canRefresh: boolean;
  onRefresh: () => void;
}

function ProjectsTab({
  projects,
  summary,
  loading,
  error,
  selectedProjectId,
  onSelect,
  selectedProject,
  canRefresh,
  onRefresh,
}: ProjectsTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Projects"
          value={summary.total}
          subtitle="All projects"
          icon="📁"
          accent="from-emerald-500/20 to-emerald-500/40"
        />
        <SummaryCard
          title="Active Projects"
          value={summary.active}
          subtitle="In progress"
          icon="📊"
          accent="from-blue-500/20 to-blue-500/40"
        />
        <SummaryCard
          title="Completed Projects"
          value={summary.completed}
          subtitle="Successfully delivered"
          icon="✅"
          accent="from-emerald-500/20 to-emerald-500/40"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-emerald-900">Chittoor project list</h2>
          <p className="text-sm text-emerald-700/80">
            Browse all projects sourced from the chitoor_projects table.
          </p>
        </div>
        <button
          onClick={() => onRefresh()}
          disabled={!canRefresh || loading}
          className="inline-flex items-center rounded-lg border border-emerald-200 px-3 py-2 text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Refresh List
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
          {loading && (
            <p className="py-6 text-center text-emerald-700">Loading projects…</p>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
              {error}
            </p>
          )}
          {!loading && !error && projects.length === 0 && (
            <p className="py-6 text-center text-emerald-700">
              No Chittoor projects available yet.
            </p>
          )}
          {!loading && !error && projects.length > 0 && (
            <div className="space-y-3">
              {projects.map((project) => {
                const id = getProjectId(project);
                const active = id === selectedProjectId;
                const statusLabel = getProjectStatusLabel(project);
                const statusTag = deriveProjectStatus(project);
                const location = getProjectLocation(project);
                const createdDate = formatDateValue(
                  pickFirstValue(project, [
                    "start_date",
                    "project_start_date",
                    "created_at",
                    "date",
                  ]),
                );
                return (
                  <button
                    type="button"
                    key={id || project.project_name || Math.random().toString(36)}
                    onClick={() => onSelect(id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-emerald-400 bg-white shadow"
                        : "border-emerald-100 bg-white/70 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-emerald-900">
                          {getProjectName(project)}
                        </h3>
                        {location && (
                          <p className="text-sm text-emerald-700/80">{location}</p>
                        )}
                        <p className="text-xs text-emerald-700/70">Created {createdDate}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                          statusTag === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : statusTag === "active"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <ProjectDetailsPanel project={selectedProject} />
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
  accent: string;
}

function SummaryCard({ title, value, subtitle, icon, accent }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-emerald-700/80">{subtitle}</p>
          <h3 className="text-2xl font-bold text-emerald-900">{value}</h3>
          <p className="text-sm text-emerald-700/70">{title}</p>
        </div>
        <span className={`grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br ${accent}`}>
          <span className="text-xl">{icon}</span>
        </span>
      </div>
    </div>
  );
}

interface ProjectDetailsPanelProps {
  project: ChitoorProjectRecord | null;
}

function ProjectDetailsPanel({ project }: ProjectDetailsPanelProps) {
  if (!project) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-white p-6 text-center text-emerald-700">
        Select a project to see its details.
      </div>
    );
  }

  const entries = getProjectDetailsEntries(project);

  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-emerald-900">Project details</h3>
      <dl className="mt-4 space-y-3">
        {entries.map((entry) => (
          <div key={`${entry.label}`} className="grid grid-cols-3 gap-2 text-sm">
            <dt className="text-emerald-700/80">{entry.label}</dt>
            <dd className="col-span-2 font-medium text-emerald-900 break-words whitespace-pre-wrap">
              {entry.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface AnalyticsPoint {
  month: string;
  approvals: number;
  projects: number;
}

interface AnalyticsTabProps {
  data: AnalyticsPoint[];
  loading: boolean;
}

function AnalyticsTab({ data, loading }: AnalyticsTabProps) {
  if (loading && data.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-white p-6 text-center text-emerald-700">
        Loading analytics…
      </div>
    );
  }

  if (!loading && data.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-white p-6 text-center text-emerald-700">
        Analytics will appear once projects and approvals have date information.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-emerald-900">Monthly comparison</h3>
        <p className="text-sm text-emerald-700/80">
          Track how CRM approvals compare with on-ground Chittoor project progress.
        </p>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
            <XAxis dataKey="month" stroke="#065f46" />
            <YAxis allowDecimals={false} stroke="#065f46" />
            <RechartsTooltip cursor={{ fill: "rgba(16, 185, 129, 0.05)" }} />
            <Legend />
            <Bar dataKey="approvals" name="Approvals" fill="#059669" radius={[4, 4, 0, 0]} />
            <Bar dataKey="projects" name="Chittoor Projects" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function getProjectId(project: ChitoorProjectRecord): string {
  const raw = project.id;
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

function getProjectName(project: ChitoorProjectRecord): string {
  const name = pickFirstValue<string>(project, ["project_name", "name", "title"]);
  if (name && name.trim()) return name;
  const id = getProjectId(project);
  return id ? `Project ${id}` : "Unnamed project";
}

function getProjectLocation(project: ChitoorProjectRecord): string | null {
  const location = pickFirstValue<string>(project, [
    "location",
    "village",
    "mandal",
    "district",
    "address",
  ]);
  return location && location.trim() ? location : null;
}

type DerivedStatus = "active" | "completed" | "other";

function deriveProjectStatus(project: ChitoorProjectRecord): DerivedStatus {
  const statusValue = pickFirstValue<string>(project, [
    "status",
    "project_status",
    "current_status",
    "stage",
    "state",
  ]);

  if (statusValue) {
    const normalized = statusValue.trim().toLowerCase();
    if (["completed", "complete", "done", "finished", "closed"].includes(normalized)) {
      return "completed";
    }
    if (
      [
        "active",
        "in progress",
        "in-progress",
        "ongoing",
        "processing",
        "running",
        "pending",
        "initiated",
      ].includes(normalized)
    ) {
      return "active";
    }
  }

  const completeFlag = toBoolean(
    pickFirstValue(project, ["is_completed", "completed", "isComplete"]),
  );
  if (completeFlag === true) return "completed";

  const activeFlag = toBoolean(pickFirstValue(project, ["is_active", "active", "isActive"]));
  if (activeFlag === true) return "active";

  return "other";
}

function getProjectStatusLabel(project: ChitoorProjectRecord): string {
  const raw = pickFirstValue<string>(project, [
    "status",
    "project_status",
    "current_status",
    "stage",
    "state",
  ]);
  if (raw && raw.trim()) return raw;
  const derived = deriveProjectStatus(project);
  if (derived === "active") return "Active";
  if (derived === "completed") return "Completed";
  return "Status unknown";
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "no", "n", "0"].includes(normalized)) return false;
  }
  return null;
}

function pickFirstValue<T = unknown>(
  project: ChitoorProjectRecord,
  keys: string[],
): T | undefined {
  for (const key of keys) {
    const value = project[key];
    if (value !== undefined && value !== null && value !== "") {
      return value as T;
    }
  }
  return undefined;
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function formatDateValue(value: unknown): string {
  const date = parseDateValue(value);
  if (!date) return "—";
  return format(date, "dd MMM yyyy");
}

function formatDetailValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (value instanceof Date) return format(value, "dd MMM yyyy");
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    const date = parseDateValue(value);
    return date ? format(date, "dd MMM yyyy") : value;
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function getProjectDetailsEntries(
  project: ChitoorProjectRecord,
): { label: string; value: string }[] {
  const usedKeys = new Set<string>();
  const entries: { label: string; value: string }[] = [];

  const pushEntry = (key: string, label: string) => {
    const raw = project[key];
    if (raw === undefined || raw === null || raw === "") return;
    usedKeys.add(key);
    entries.push({ label, value: formatDetailValue(raw) });
  };

  const fieldGroups: { keys: string[]; label: string }[] = [
    { keys: ["project_name", "name", "title"], label: "Project Name" },
    {
      keys: ["status", "project_status", "current_status", "stage", "state"],
      label: "Status",
    },
    { keys: ["location", "village", "mandal", "district", "address"], label: "Location" },
    { keys: ["start_date", "project_start_date"], label: "Start Date" },
    {
      keys: ["completion_date", "end_date", "project_end_date"],
      label: "Completion Date",
    },
    { keys: ["created_at"], label: "Created At" },
    { keys: ["updated_at"], label: "Updated At" },
    { keys: ["capacity_kw", "capacity"], label: "Capacity" },
    { keys: ["project_cost", "cost", "total_cost"], label: "Project Cost" },
  ];

  for (const group of fieldGroups) {
    for (const key of group.keys) {
      if (project[key] !== undefined && project[key] !== null && project[key] !== "") {
        pushEntry(key, group.label);
        break;
      }
    }
  }

  Object.keys(project)
    .filter((key) => !usedKeys.has(key) && key !== "id")
    .sort()
    .forEach((key) => {
      const value = project[key];
      if (value === undefined || value === null || value === "") return;
      const label = key
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
      entries.push({ label, value: formatDetailValue(value) });
    });

  return entries;
}

function buildMonthlyAnalytics(
  approvals: ChittoorProject[],
  projects: ChitoorProjectRecord[],
): AnalyticsPoint[] {
  const map = new Map<
    string,
    { month: string; timestamp: number; approvals: number; projects: number }
  >();

  const add = (dateValue: unknown, key: "approvals" | "projects") => {
    const parsed = parseDateValue(dateValue);
    if (!parsed) return;
    const monthDate = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    const label = format(monthDate, "MMM yyyy");
    const existing =
      map.get(label) ?? {
        month: label,
        timestamp: monthDate.getTime(),
        approvals: 0,
        projects: 0,
      };
    existing[key] += 1;
    map.set(label, existing);
  };

  approvals.forEach((item) => {
    add(item.date ?? item.created_at, "approvals");
  });

  projects.forEach((project) => {
    const dateCandidate =
      pickFirstValue(project, [
        "start_date",
        "project_start_date",
        "date",
        "project_date",
        "created_at",
        "updated_at",
        "completion_date",
      ]) ?? null;
    add(dateCandidate, "projects");
  });

  return Array.from(map.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ timestamp, ...rest }) => rest);
}
