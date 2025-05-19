# frozen_string_literal: true

class CreateCompanyMonthlyFinancialReports < ActiveRecord::Migration[7.1]
  def change
    create_table :company_monthly_financial_reports do |t|
      t.references :company, null: false
      t.integer :year, null: false
      t.integer :month, null: false
      t.bigint :net_income_cents, null: false
      t.bigint :revenue_cents, null: false
      t.timestamps
    end

    add_index :company_monthly_financial_reports, [:company_id, :year, :month], unique: true, name: 'index_company_monthly_financials_on_company_year_month'
  end
end
