import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase, hasSupabaseEnv } from "@/utils/supabaseClient";
import villagesCSV from "./villages.csv?raw";
import type {
  ChittoorProject,
  SiteVisitStatus,
  SubsidyScope,
} from "@shared/api";

const schema = z.object({
  project_name: z.string().min(2, "Required"),
  date: z.string().optional().or(z.literal("")),
  capacity_kw: z.enum(["2", "3"]).nullable().optional(),
  // location removed per request
  village: z.string().nullable().optional(),
  mandal: z.string().nullable().optional(),
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
    .regex(/^[0-9]{10,15}$/, "Enter a valid mobile number"),
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
  const [mapping, setMapping] = useState<{ mandal: string; village: string }[]>(
    [],
  );
  const [villageFilter, setVillageFilter] = useState("");
  const [mandalFilter, setMandalFilter] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualVillage, setManualVillage] = useState("");
  const [manualMandal, setManualMandal] = useState("");
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_name: "",
      date: "",
      capacity_kw: undefined,
      // location removed
      village: "",
      mandal: "",
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

  // Load mandal/village mapping from Supabase if available; fall back to local CSV bundle
  useEffect(() => {
    const parseCSV = (csv: string) => {
      const out: { mandal: string; village: string }[] = [];
      csv.split(/\r?\n/).forEach((line) => {
        const ln = line.trim();
        if (!ln) return;
        if (/^Village\s*,\s*Mandal$/i.test(ln)) return;
        const idx = ln.lastIndexOf(",");
        if (idx === -1) return;
        const village = ln.slice(0, idx).trim();
        const mandal = ln.slice(idx + 1).trim();
        if (village && mandal) out.push({ village, mandal });
      });
      return out;
    };

    const local = parseCSV(villagesCSV || "");

    if (!hasSupabaseEnv) {
      // use local only
      const uniq = Array.from(
        new Map(local.map((r) => [r.village.toLowerCase(), r])).values(),
      );
      setMapping(uniq);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("mandal_villages")
          .select("mandal,village");
        const supa =
          !error && Array.isArray(data)
            ? (data as any[]).map((r) => ({
                village: String(r.village || "").trim(),
                mandal: String(r.mandal || "").trim(),
              }))
            : [];

        const map = new Map<string, { mandal: string; village: string }>();
        for (const r of local) map.set(r.village.toLowerCase(), r);
        for (const r of supa) map.set(r.village.toLowerCase(), r);
        setMapping(Array.from(map.values()));
      } catch (err) {
        const uniq = Array.from(
          new Map(local.map((r) => [r.village.toLowerCase(), r])).values(),
        );
        setMapping(uniq);
      }
    })();
  }, []);

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
            : undefined,
        // location removed from form reset
        village: (p as any).village ?? "",
        mandal: (p as any).mandal ?? "",
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
      const imgs = Array.isArray((p as any).images)
        ? ((p as any).images as string[])
        : [];
      setExistingImages(imgs);
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

      let targetId = id ?? null;

      if (isEdit) {
        const { error } = await supabase
          .from("chittoor_project_approvals")
          .update(payload)
          .eq("id", id!);
        if (error) throw error;
        targetId = id!;
      } else {
        const { data, error } = await supabase
          .from("chittoor_project_approvals")
          .insert({ ...payload, approval_status: "pending" })
          .select("id")
          .single();
        if (error) throw error;
        targetId = (data as any).id as string;
      }

      if (imageFiles.length && targetId) {
        const urls: string[] = [...existingImages];
        for (const file of imageFiles) {
          const path = `${targetId}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage
            .from("project-images")
            .upload(path, file, { upsert: false });
          if (upErr) {
            const msg = String(upErr.message || upErr).toLowerCase();
            if (msg.includes("bucket") || msg.includes("not found")) {
              throw new Error(
                "Supabase storage bucket 'project-images' not found. Create the bucket in Supabase Storage or remove image uploads.",
              );
            }
            throw upErr;
          }
          const { data: pub } = supabase.storage
            .from("project-images")
            .getPublicUrl(path);
          if (pub?.publicUrl) urls.push(pub.publicUrl);
        }
        const { error: updErr } = await supabase
          .from("chittoor_project_approvals")
          .update({ images: urls })
          .eq("id", targetId);
        if (updErr) throw updErr;
      }

      navigate("/");
    } catch (e: any) {
      alert(e.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  // compute unique mandals and villages, apply mandal filter and village text filter
  const _mandals = Array.from(
    new Set(mapping.map((r) => r.mandal).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const filteredMandals = mandalFilter.trim().length >= 2
    ? _mandals.filter((m) => m.toLowerCase().includes(mandalFilter.trim().toLowerCase()))
    : _mandals;

  const selectedMandal = (form.watch("mandal") || "").trim();
  const villagesSource = selectedMandal
    ? mapping.filter((r) => r.mandal === selectedMandal).map((r) => r.village)
    : mapping.map((r) => r.village);
  const _villages = Array.from(new Set(villagesSource.filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );

  const filteredVillages = (() => {
    const q = villageFilter.trim().toLowerCase();
    if (q.length >= 3) return _villages.filter((v) => v.toLowerCase().includes(q));
    if (selectedMandal) return _villages; // show mandal's villages when mandal selected
    return []; // require user to type 3+ letters or select mandal
  })();

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
              onChange={(e) => {
                const value = e.target.value as "2" | "3" | "";
                form.setValue("capacity_kw", value || undefined);
                if (value === "2") form.setValue("project_cost", 148000);
                if (value === "3") form.setValue("project_cost", 205000);
              }}
            >
              <option value="">Select</option>
              <option value="2">2 kW</option>
              <option value="3">3 kW</option>
            </select>
          </div>

          {/* Village (auto-fills Mandal) */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Village</label>
            {mapping.length > 0 ? (
              <>
                <label className="text-sm font-medium">Mandal</label>
                <input
                  type="text"
                  placeholder="Type 2+ letters to filter mandals"
                  className="w-full mb-2 rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  value={mandalFilter}
                  onChange={(e) => setMandalFilter(e.target.value)}
                />

                <select
                  className="w-full mb-2 rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  value={form.watch("mandal") ?? ""}
                  onChange={(e) => {
                    const m = e.target.value;
                    if (m === "__other__") {
                      setManualMode(true);
                      form.setValue("mandal", "");
                      setManualMandal("");
                      return;
                    }
                    form.setValue("mandal", m);
                    // clear any selected village when mandal changes
                    form.setValue("village", "");
                    setVillageFilter("");
                    setManualMode(false);
                  }}
                >
                  <option value="">All Mandals</option>
                  {filteredMandals.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="__other__">Other (type mandal)</option>
                </select>

                {!manualMode ? (
                  <>
                    <input
                      type="text"
                      placeholder="Type 3+ letters to filter villages"
                      className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
                      value={villageFilter}
                      onChange={(e) => setVillageFilter(e.target.value)}
                    />

                    <select
                      className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={form.watch("village") ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__other__") {
                          setManualMode(true);
                          form.setValue("village", "");
                          form.setValue("mandal", "");
                          setManualVillage("");
                          setManualMandal("");
                          return;
                        }
                        form.setValue("village", v);
                        const rec = mapping.find((r) => r.village === v);
                        form.setValue("mandal", rec ? rec.mandal : "");
                        setManualMode(false);
                      }}
                    >
                      <option value="">Select village</option>
                      {filteredVillages.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                      <option value="__other__">Other (type manually)</option>
                    </select>

                    {villageFilter.trim().length >= 3 &&
                      filteredVillages.length === 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          No villages match your search — choose "Other" to type
                          manually
                        </p>
                      )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Enter village manually"
                      className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={manualVillage}
                      onChange={(e) => {
                        setManualVillage(e.target.value);
                        form.setValue("village", e.target.value);
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Enter mandal manually"
                      className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={manualMandal}
                      onChange={(e) => {
                        setManualMandal(e.target.value);
                        form.setValue("mandal", e.target.value);
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-emerald-200 px-3 py-1.5 text-emerald-800 hover:bg-emerald-50"
                        onClick={() => {
                          // cancel manual mode
                          setManualMode(false);
                          setManualVillage("");
                          setManualMandal("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <input
                className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter village"
                {...form.register("village")}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val && mapping.length) {
                    const rec = mapping.find((r) => r.village === val);
                    form.setValue(
                      "mandal",
                      rec ? rec.mandal : (form.getValues("mandal") ?? ""),
                    );
                  }
                }}
              />
            )}
          </div>

          {/* Mandal input (hidden when mapping present since a mandal select is shown above) */}
          <div
            className="space-y-1"
            style={{ display: mapping.length > 0 ? "none" : undefined }}
          >
            <label className="text-sm font-medium">Mandal</label>
            <input
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              {...form.register("mandal")}
            />
          </div>

          {/* Customer Mobile Number */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Customer Mobile Number
            </label>
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
            <select
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.watch("project_cost") ?? ""}
              onChange={(e) => {
                const n = e.target.value ? Number(e.target.value) : undefined;
                form.setValue("project_cost", (n as any) ?? undefined);
              }}
            >
              <option value="">Select</option>
              <option value={148000}>₹148,000</option>
              <option value={205000}>₹205,000</option>
            </select>
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

          {/* Images */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium">Upload Images</label>
            <input
              type="file"
              accept="image/*"
              multiple
              className="w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2"
              onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
            />
            {existingImages.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {existingImages.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt="project"
                    className="h-24 w-full rounded-md object-cover border border-emerald-200"
                  />
                ))}
              </div>
            )}
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
