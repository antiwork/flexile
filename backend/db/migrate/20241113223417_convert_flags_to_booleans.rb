class ConvertFlagsToBooleans < ActiveRecord::Migration[7.2]
  def change
    change_table :companies do |t|
      t.boolean :is_gumroad, default: false
      t.boolean :dividends_allowed, default: false
      t.boolean :is_trusted, default: false
      t.boolean :show_contractor_list_to_contractors, default: false
      t.boolean :show_stats_in_job_descriptions, default: false
      t.boolean :irs_tax_forms, default: false
      t.boolean :equity_grants_enabled, default: false
    end

    change_table :company_roles do |t|
      t.boolean :trial_enabled, default: false
      t.boolean :expense_card_enabled, default: false
    end

    change_table :company_updates do |t|
      t.boolean :show_revenue, default: false
      t.boolean :show_net_income, default: false
    end

    change_table :company_contractors do |t|
      t.boolean :sent_equity_percent_selection_email, default: false
      t.boolean :on_trial, default: false
    end

    change_table :company_investors do |t|
      t.boolean :invested_in_angel_list_ruv, default: false
    end

    change_table :share_classes do |t|
      t.boolean :preferred, default: false
    end

    change_table :equity_allocations do |t|
      t.boolean :locked, default: false
      t.boolean :sent_equity_percent_selection_email, default: false
    end

    change_table :integration_records do |t|
      t.boolean :quickbooks_journal_entry, default: false
    end

    change_table :contracts do |t|
      t.boolean :equity_options_plan, default: false
      t.boolean :certificate, default: false
    end

    change_table :contractor_profiles do |t|
      t.boolean :available_for_hire, default: false
    end

    change_table :investor_dividend_rounds do |t|
      t.boolean :sanctioned_country_email_sent, default: false
      t.boolean :payout_below_threshold_email_sent, default: false
      t.boolean :dividend_issued_email_sent, default: false
    end

    change_table :users do |t|
      t.boolean :signed_documents, default: false
      t.boolean :requires_new_contract, default: false
      t.boolean :team_member, default: false
      t.boolean :sent_invalid_tax_id_email, default: false
      t.boolean :inviting_company, default: false
    end

    change_table :user_compliance_infos do |t|
      t.boolean :business_entity, default: false
    end
  end
end
