class MakeFlagColumnsNotNull < ActiveRecord::Migration[7.2]
  def change
    change_column_null :companies, :is_gumroad, false
    change_column_null :companies, :dividends_allowed, false
    change_column_null :companies, :is_trusted, false
    change_column_null :companies, :show_contractor_list_to_contractors, false
    change_column_null :companies, :show_stats_in_job_descriptions, false
    change_column_null :companies, :irs_tax_forms, false
    change_column_null :companies, :equity_grants_enabled, false
    change_column_null :companies, :company_updates_enabled, false
    change_column_null :companies, :show_analytics_to_contractors, false

    change_column_null :company_roles, :trial_enabled, false
    change_column_null :company_roles, :expense_card_enabled, false

    change_column_null :company_updates, :show_revenue, false
    change_column_null :company_updates, :show_net_income, false

    change_column_null :company_contractors, :sent_equity_percent_selection_email, false
    change_column_null :company_contractors, :on_trial, false

    change_column_null :company_investors, :invested_in_angel_list_ruv, false

    change_column_null :share_classes, :preferred, false

    change_column_null :equity_allocations, :locked, false
    change_column_null :equity_allocations, :sent_equity_percent_selection_email, false

    change_column_null :integration_records, :quickbooks_journal_entry, false

    change_column_null :contracts, :equity_options_plan, false
    change_column_null :contracts, :certificate, false

    change_column_null :contractor_profiles, :available_for_hire, false

    change_column_null :investor_dividend_rounds, :sanctioned_country_email_sent, false
    change_column_null :investor_dividend_rounds, :payout_below_threshold_email_sent, false
    change_column_null :investor_dividend_rounds, :dividend_issued_email_sent, false

    change_column_null :users, :signed_documents, false
    change_column_null :users, :requires_new_contract, false
    change_column_null :users, :team_member, false
    change_column_null :users, :sent_invalid_tax_id_email, false
    change_column_null :users, :inviting_company, false

    change_column_null :user_compliance_infos, :business_entity, false
  end
end
