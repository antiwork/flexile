export enum PayRateType {
  Hourly = 0,
  ProjectBased,
  Salary,
}

export enum DocumentType {
  ConsultingContract = 0,
  EquityPlanContract,
  ShareCertificate,
  TaxDocument,
  ExerciseNotice,
  BoardConsent,
}

export enum DocumentTemplateType {
  ConsultingContract = 0,
  EquityPlanContract,
  BoardConsent,
}

export enum BusinessType {
  LLC = 0,
  CCorporation,
  SCorporation,
  Partnership,
}

export enum TaxClassification {
  CCorporation = 0,
  SCorporation,
  Partnership,
}

export enum BoardConsentStatus {
  Pending = "pending",
  LawyerApproved = "lawyer_approved",
  BoardApproved = "board_approved",
}

export enum EquityAllocationStatus {
  PendingConfirmation = "pending_confirmation",
  PendingGrantCreation = "pending_grant_creation",
  PendingApproval = "pending_approval",
  Approved = "approved",
}

export const invoiceStatuses = [
  "received",
  "approved",
  "processing",
  "payment_pending",
  "paid",
  "rejected",
  "failed",
] as const;

export const optionGrantTypes = ["iso", "nso"] as const;
export const optionGrantVestingTriggers = ["scheduled", "invoice_paid"] as const;
export const optionGrantIssueDateRelationships = [
  "employee",
  "consultant",
  "investor",
  "founder",
  "officer",
  "executive",
  "board_member",
] as const;

export const companyUpdatePeriods = ["month", "quarter", "year"] as const;
