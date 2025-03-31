import type { CONTRACT_TYPES, EQUITY_TYPES, LOCATION_TYPES } from "./constants";

export interface INVITE_CONTRACTOR_FORM_STATE {
  email: string;
  role: string;
  location: LOCATION_TYPES;
  type: CONTRACT_TYPES;
  compensation: {
    yearly: string;
    hourly: string;
  };
  startDate: string;
  equity: {
    type: EQUITY_TYPES;
    fixed: string;
    range: [number, number];
  };
}

export interface ROLE_DATA {
  defaultRate: number;
  defaultSalary: number;
  defaultEquity: { min: number; max: number };
}

// Role data configuration
export const ROLE_DATA_CONFIG: Record<string, ROLE_DATA> = {
  developer: { defaultRate: 100, defaultSalary: 120000, defaultEquity: { min: 20, max: 80 } },
  designer: { defaultRate: 90, defaultSalary: 110000, defaultEquity: { min: 20, max: 80 } },
  "project-manager": { defaultRate: 110, defaultSalary: 130000, defaultEquity: { min: 20, max: 80 } },
  consultant: { defaultRate: 150, defaultSalary: 160000, defaultEquity: { min: 20, max: 80 } },
  vendor: { defaultRate: 0, defaultSalary: 0, defaultEquity: { min: 0, max: 10 } },
};

export const ROLES = [
  { value: "developer", label: "Developer" },
  { value: "designer", label: "Designer" },
  { value: "project-manager", label: "Project Manager" },
  { value: "consultant", label: "Consultant" },
  { value: "vendor", label: "Vendor" },
];
