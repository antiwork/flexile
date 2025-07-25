export const PayRateType = {
  Hourly: 0,
  Custom: 1,
} as const;

export type PayRateType = (typeof PayRateType)[keyof typeof PayRateType];

export const DocumentType = {
  ConsultingContract: 0,
  EquityPlanContract: 1,
  ShareCertificate: 2,
  TaxDocument: 3,
  ExerciseNotice: 4,
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentTemplateType = {
  ConsultingContract: 0,
  EquityPlanContract: 1,
} as const;

export type DocumentTemplateType = (typeof DocumentTemplateType)[keyof typeof DocumentTemplateType];

export const BusinessType = {
  LLC: 0,
  CCorporation: 1,
  SCorporation: 2,
  Partnership: 3,
} as const;

export type BusinessType = (typeof BusinessType)[keyof typeof BusinessType];

export const TaxClassification = {
  CCorporation: 0,
  SCorporation: 1,
  Partnership: 2,
} as const;

export type TaxClassification = (typeof TaxClassification)[keyof typeof TaxClassification];

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
