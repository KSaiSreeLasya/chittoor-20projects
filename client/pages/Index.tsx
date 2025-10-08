import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, hasSupabaseEnv } from "@/utils/supabaseClient";
import type { ChittoorProject } from "@shared/api";
import { format } from "date-fns";

export default function Index() {
  const [projects, setProjects] = useState<ChittoorProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    void fetchProjects();
  }, [filter]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = supabase
        .from("chittoor_project_approvals")
        .select("*")
        .order("created_at", { ascending: false });
      if (filter !== "all") {
        query = query.eq("approval_status", filter);
      }
      const { data, error } = await query;
      if (error) throw error;
      setProjects(data as unknown as ChittoorProject[]);
    } catch (e: any) {
      setError(e.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const hasKeys = hasSupabaseEnv;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: projects.length,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    for (const p of projects) counts[p.approval_status]++;
    return counts;
  }, [projects]);

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    const channel = supabase
      .channel("chittoor-approvals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chittoor_project_approvals" },
        (payload: any) => {
          setProjects((prev) => {
            if (payload.eventType === "INSERT") return [payload.new as any, ...prev];
            if (payload.eventType === "UPDATE") return prev.map((p) => (p.id === (payload.new as any).id ? { ...p, ...(payload.new as any) } : p));
            if (payload.eventType === "DELETE") return prev.filter((p) => p.id !== (payload.old as any).id);
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
      <div className="container py-10">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-emerald-900">
              Chittoor Projects
            </h1>
            <p className="text-emerald-700/80 mt-2">
              Track project details, request payments, and view CRM approvals in
              real time.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => fetchProjects()} className="inline-flex items-center rounded-lg border border-emerald-200 px-4 py-2 text-emerald-800 hover:bg-emerald-50">Refresh</button>
            <Link
              to="/projects/new"
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700 transition-colors"
            >
              + New Project
            </Link>
          </div>
        </header>

        {!hasKeys && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <p className="font-semibold">Supabase not configured</p>
            <p className="text-sm mt-1">
              Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. You can connect
              Supabase via MCP. Click{" "}
              <a className="underline" href="#open-mcp-popover">
                Open MCP popover
              </a>{" "}
              then Connect to Supabase.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "approved", label: "Approved" },
            { key: "rejected", label: "Rejected" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                filter === s.key
                  ? "bg-emerald-600 text-white border-emerald-700"
                  : "bg-white/70 backdrop-blur border-emerald-200 hover:bg-white"
              }`}
            >
              <div className="text-sm opacity-80">{s.label}</div>
              <div className="text-2xl font-bold">
                {statusCounts[s.key as keyof typeof statusCounts] ?? 0}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-xl overflow-hidden border border-emerald-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-emerald-50 text-emerald-900">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Project</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Capacity (kW)
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Power Bill #
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Cost</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Site Visit
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Payment</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Approval
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-emerald-700"
                      colSpan={10}
                    >
                      Loading projects…
                    </td>
                  </tr>
                )}
                {error && (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-red-600"
                      colSpan={10}
                    >
                      {error}
                    </td>
                  </tr>
                )}
                {!loading && !error && projects.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-emerald-700"
                      colSpan={10}
                    >
                      No projects yet. Create your first project.
                    </td>
                  </tr>
                )}
                {projects.map((p) => (
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
                    <td className="px-4 py-3 text-emerald-800">
                      {p.location ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-emerald-800">
                      {p.power_bill_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-emerald-800">
                      {p.project_cost
                        ? `₹${p.project_cost.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-emerald-800">
                      {p.site_visit_status ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-emerald-800">
                      {p.payment_amount
                        ? `₹${p.payment_amount.toLocaleString()}`
                        : "—"}
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
                            const { error } = await supabase
                              .from("chittoor_project_approvals")
                              .delete()
                              .eq("id", p.id);
                            if (!error)
                              setProjects((prev) =>
                                prev.filter((x) => x.id !== p.id),
                              );
                            else alert(error.message);
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

        <p className="mt-6 text-sm text-emerald-800/80">
          Approval status is synced from crm.axisogreen.in via shared Supabase.
          This app shows latest status and details.
        </p>
      </div>
    </div>
  );
}
