export type QuickbooksIntegrationConfiguration = {
  access_token: string;
  expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  flexile_vendor_id: string;
  consulting_services_expense_account_id: string;
  flexile_fees_expense_account_id: string;
  equity_compensation_expense_account_id: string | null;
  default_bank_account_id: string;
  flexile_clearance_bank_account_id: string;
};

export type GithubIntegrationConfiguration = {
  organization: string;
};
