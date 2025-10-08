import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/utils/supabaseClient";
import type { ChittoorProject } from "@shared/api";
import { format } from "date-fns";

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState<ChittoorProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("chittoor_project_approvals")
          .select("*")
          .eq("id", id!)
          .single();
        if (error) throw error;
        setP(data as ChittoorProject);
      } catch (e: any) {
        setError(e.message || "Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel("detail-approval")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chittoor_project_approvals",
          filter: `id=eq.${id}`,
        },
        (payload: any) => {
          setP((prev) =>
            prev ? { ...prev, ...(payload.new as any) } : (payload.new as any),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
      <div className="container py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-emerald-900">
            Project Details
          </h2>
          <div className="flex gap-2">
            {p && (
              <Link
                to={`/projects/${p.id}/edit`}
                className="rounded-md border border-emerald-200 px-3 py-1.5 text-emerald-800 hover:bg-emerald-50"
              >
                Edit
              </Link>
            )}
            <button
              onClick={() => navigate(-1)}
              className="rounded-md border border-emerald-200 px-3 py-1.5 text-emerald-800 hover:bg-emerald-50"
            >
              Back
            </button>
          </div>
        </div>
        {loading && (
          <div className="rounded-xl border border-emerald-200 bg-white p-6">
            Loading…
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}
        {p && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-emerald-900">
                Overview
              </h3>
              <dl className="grid grid-cols-1 gap-3">
                <div>
                  <dt className="text-sm text-emerald-700/80">Project Name</dt>
                  <dd className="font-medium text-emerald-900">
                    {p.project_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-emerald-700/80">Date</dt>
                  <dd className="font-medium text-emerald-900">
                    {p.date ? format(new Date(p.date), "dd MMM yyyy") : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-emerald-700/80">Capacity (kW)</dt>
                  <dd className="font-medium text-emerald-900">
                    {p.capacity_kw ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-emerald-700/80">
                    Villages / Location
                  </dt>
                  <dd className="font-medium text-emerald-900">
                    {p.location ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-emerald-700/80">
                    Power Bill Number
                  </dt>
                  <dd className="font-medium text-emerald-900">
                    {p.power_bill_number ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-emerald-700/80">Project Cost</dt>
                  <dd className="font-medium text-emerald-900">
                    {p.project_cost
                      ? `₹${p.project_cost.toLocaleString()}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-emerald-900">
                Status & Billing
              </h3>
              <dl className="grid grid-cols-1 gap-3">
                <div>
                  <dt className="text-sm text-emerald-700/80">
                    Site Visit Status
                  </dt>
                  <dd className="font-medium text-emerald-900">
                    {p.site_visit_status ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-emerald-700/80">
                    Payment Request (₹)
                  </dt>
                  <dd className="font-medium text-emerald-900">
                    {p.payment_amount
                      ? `₹${p.payment_amount.toLocaleString()}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-emerald-700/80">
                    Banking Ref ID
                  </dt>
                  <dd className="font-medium text-emerald-900">
                    {p.banking_ref_id ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-emerald-700/80">
                    Service Number
                  </dt>
                  <dd className="font-medium text-emerald-900">
                    {p.service_number ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-emerald-700/80">
                    Service Status
                  </dt>
                  <dd className="font-medium text-emerald-900">
                    {p.service_status ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-emerald-700/80">
                    Approval (CRM)
                  </dt>
                  <dd className="font-medium">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${p.approval_status === "approved" ? "bg-emerald-100 text-emerald-800" : p.approval_status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}
                    >
                      {p.approval_status}
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-emerald-700/70">
                Updated:{" "}
                {p.approval_updated_at
                  ? format(
                      new Date(p.approval_updated_at),
                      "dd MMM yyyy, HH:mm",
                    )
                  : "—"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
