/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

// Chittoor Project types shared across client & server
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type SiteVisitStatus = "Planned" | "Visited" | "Pending" | "Completed";
export type SubsidyScope = "Axiso" | "Customer";

export interface ChittoorProject {
  id: string;
  created_at: string;
  project_name: string;
  date: string | null; // ISO string
  capacity_kw: number | null;
  location: string | null;
  power_bill_number: string | null;
  project_cost: number | null;
  site_visit_status: SiteVisitStatus | null;
  payment_amount: number | null;
  banking_ref_id: string | null;
  service_number: string | null;
  service_status: string | null;
  biller_name: string | null;
  customer_mobile_number: string | null;
  site_visitor_name: string | null;
  subsidy_scope: SubsidyScope | null;
  approval_status: ApprovalStatus; // managed by crm.axisogreen.in
  approval_updated_at: string | null;
}

export interface UpsertChittoorProject
  extends Partial<
    Omit<
      ChittoorProject,
      "id" | "created_at" | "approval_status" | "approval_updated_at"
    >
  > {
  id?: string;
}
