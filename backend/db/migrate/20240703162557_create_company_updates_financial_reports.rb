# frozen_string_literal: true

class CreateCompanyUpdatesFinancialReports < ActiveRecord::Migration[7.1]
  def change
    create_table :company_updates_financial_reports do |t|
      t.belongs_to :company_update, null: false
      t.belongs_to :company_monthly_financial_report, null: false
      t.timestamps
    end
  end
end
