import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase, hasSupabaseEnv } from "@/utils/supabaseClient";
import type {
  ChittoorProject,
  SiteVisitStatus,
  SubsidyScope,
} from "@shared/api";

const schema = z.object({
  project_name: z.string().min(2, "Required"),
  date: z.string().optional().or(z.literal("")),
  capacity_kw: z.enum(["2", "3"]).nullable().optional(), // Updated: select type
  location: z.string().nullable().optional(),
  power_bill_number: z.string().nullable().optional(),
  project_cost: z.coerce.number().min(0).nullable().optional(),
  site_visit_status: z
    .enum(["Planned", "Visited", "Pending", "Completed"])
    .nullable()
    .optional(),
  payment_amount: z.coerce.number().min(0).nullable().optional(),
  banking_ref_id: z.string().nullable().optional(),
  service_number: z.string().nullable().optional(),
  service_status: z.string().nullable().optional(),
  biller_name: z.string().nullable().optional(),
  customer_mobile_number: z
    .string()
    .min(10, "Enter a valid mobile number")
    .max(15, "Enter a valid mobile number"),
  site_visitor_name: z.string().min(2, "Visitor name is required"),
  subsidy_scope: z.enum(["Axiso", "Customer"]),
});

type FormValues = z.infer<typeof schema>;

export default function ProjectForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_name: "",
      date: "",
      capacity_kw: undefined,
      location: "",
      power_bill_number: "",
      project_cost: undefined,
      site_visit_status: "Planned",
      payment_amount: undefined,
      banking_ref_id: "",
      service_number: "",
      service_status: "",
      biller_name: "",
      customer_mobile_number: "",
      site_visitor_name: "",
      subsidy_scope: "Axiso",
    },
  });

  useEffect(() => {
    if (!id || !hasSupabaseEnv) return;
    void load();
  }, [id]);

  const load = async () => {
    if (!hasSupabaseEnv) {
      setLoadError(
        "Supabase not configured. Click Open MCP popover and connect to Supabase.",
      );
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("chittoor_project_approvals")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      const p = data as unknown as ChittoorProject;
      form.reset({
        project_name: p.project_name ?? "",
        date: p.date ?? "",
        capacity_kw:
          p.capacity_kw !== null && p.capacity_kw !== undefined
            ? (String(p.capacity_kw) as "2" | "3")
            : undefined, // ✅ Handle as string
        location: p.location ?? "",
        power_bill_number: p.power_bill_number ?? "",
        project_cost: p.project_cost ?? undefined,
        site_visit_status:
          (p.site_visit_status as SiteVisitStatus) ?? "Planned",
        payment_amount: p.payment_amount ?? undefined,
        banking_ref_id: p.banking_ref_id ?? "",
        service_number: p.service_number ?? "",
        service_status: p.service_status ?? "",
        biller_name: p.biller_name ?? "",
      customer_mobile_number: p.customer_mobile_number ?? "",
      site_visitor_name: p.site_visitor_name ?? "",
      subsidy_scope: (p.subsidy_scope as SubsidyScope | null) ?? "Axiso",
    });
    } catch (e: any) {
      setLoadError(e.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!hasSupabaseEnv) {
      alert(
        "Supabase not configured. Click Open MCP popover and connect to Supabase.",
      );
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...values,
        customer_mobile_number: values.customer_mobile_number.trim(),
        site_visitor_name: values.site_visitor_name.trim(),
        subsidy_scope: values.subsidy_scope,
        capacity_kw: values.capacity_kw ? Number(values.capacity_kw) : null,
        date: values.date ? new Date(values.date).toISOString() : null,
      } as any;

      if (isEdit) {
        const { error } = await supabase
          .from("chittoor_project_approvals")
          .update(payload)
          .eq("id", id!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("chittoor_project_approvals")
          .insert({ ...payload, approval_status: "pending" });
        if (error) throw error;
      }
      navigate("/");
    } catch (e: any) {
      alert(e.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
      <div className="container py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-emerald-900">
            {isEdit ? "Edit Project" : "New Project"}
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="rounded-md border border-emerald-200 px-3 py-1.5 text-emerald-800 hover:bg-emerald-50"
          >
            Back
          </button>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {loadError}
          </div>
        )}

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {/* Project Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Project Name</label>
            <input
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("project_name")}
            />
            <p className="text-xs text-red-600">
              {form.formState.errors.project_name?.message}
            </p>
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("date")}
            />
          </div>

          {/* Capacity (Dropdown) */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Capacity (kW)</label>
            <select
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("capacity_kw")}
            >
              <option value="">Select</option>
              <option value="2">2 kW</option>
              <option value="3">3 kW</option>
            </select>
          </div>

          {/* Location */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Villages / Location</label>
            <input
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("location")}
            />
          </div>

          {/* Customer Mobile Number */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Customer Mobile Number</label>
            <input
              type="tel"
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("customer_mobile_number")}
            />
            <p className="text-xs text-red-600">
              {form.formState.errors.customer_mobile_number?.message}
            </p>
          </div>

          {/* Power Bill Number */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Power Bill Number</label>
            <input
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("power_bill_number")}
            />
          </div>

          {/* Project Cost */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Project Cost (₹)</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("project_cost", { valueAsNumber: true })}
            />
          </div>

          {/* Site Visit Status */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Site Visit Status</label>
            <select
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("site_visit_status")}
            >
              <option>Planned</option>
              <option>Visited</option>
              <option>Pending</option>
              <option>Completed</option>
            </select>
          </div>

          {/* Site Visitor Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Site Visitor Name</label>
            <input
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("site_visitor_name")}
            />
            <p className="text-xs text-red-600">
              {form.formState.errors.site_visitor_name?.message}
            </p>
          </div>

          {/* Subsidy Scope */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Subsidy Scope</label>
            <select
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("subsidy_scope")}
            >
              <option value="Axiso">Axiso</option>
              <option value="Customer">Customer</option>
            </select>
          </div>

          {/* Payment Request */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Payment Request (Amount ₹)
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("payment_amount", { valueAsNumber: true })}
            />
          </div>

          {/* Banking Ref ID */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Banking Ref ID</label>
            <input
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("banking_ref_id")}
            />
          </div>

          {/* Service Number */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Service Number of Power Bill
            </label>
            <input
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("service_number")}
            />
          </div>

          {/* Service Status */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Service Status</label>
            <input
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("service_status")}
            />
          </div>

          {/* ✅ Biller Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Biller Name</label>
            <input
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("biller_name")}
            />
          </div>

          {/* Approval Note */}
          <div className="md:col-span-2 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-900">
            <p className="text-sm">
              Approval Status is managed on{" "}
              <span className="font-semibold">crm.axisogreen.in</span> and
              synced here via Supabase (read-only in this form).
            </p>
          </div>

          {/* Buttons */}
          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-md border border-emerald-200 px-4 py-2 text-emerald-800 hover:bg-emerald-50"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              type="submit"
            >
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
