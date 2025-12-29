export enum PayRateType {
  Hourly = 0,
  Custom,
}

export enum DocumentType {
  ConsultingContract = 0,
  EquityPlanContract,
  ShareCertificate,
  Form1099NEC,
  ExerciseNotice,
  ReleaseAgreement,
  Form1099DIV,
  Form1042S,
  FormW9,
  FormW8BEN,
  FormW8BENE,
}

export enum DocumentTemplateType {
  ConsultingContract = 0,
  ExerciseNotice,
  LetterOfTransmittal,
  StockOptionAgreement,
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

export enum SignInMethod {
  Email = "email",
  Google = "google",
  GitHub = "github",
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
