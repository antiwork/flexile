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

export enum RoleApplicationStatus {
  Pending = 0,
  Accepted,
  Denied,
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
