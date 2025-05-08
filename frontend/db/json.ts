export type QuickbooksIntegrationConfiguration = {
  expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  access_token: string;
  flexile_vendor_id: string;
  flexile_clearance_bank_account_id: string;
  consulting_services_expense_account_id: string | null;
  flexile_fees_expense_account_id: string | null;
  default_bank_account_id: string | null;
  equity_compensation_expense_account_id: string | null;
};

export type GitHubIntegrationConfiguration = {
  organizations: string[];
  access_token: string;
  webhooks: { id: string; organization: string }[];
};
