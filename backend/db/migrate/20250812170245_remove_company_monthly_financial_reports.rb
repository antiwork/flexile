class RemoveCompanyMonthlyFinancialReports < ActiveRecord::Migration[8.0]
  def change
    # Drop join table first since it references the main table
    drop_table :company_updates_financial_reports do |t|
      t.belongs_to :company_update, null: false
      t.belongs_to :company_monthly_financial_report, null: false
      t.timestamps
    end

    # Drop main table second
    drop_table :company_monthly_financial_reports do |t|
      t.references :company, null: false
      t.integer :year, null: false
      t.integer :month, null: false
      t.bigint :net_income_cents, null: false
      t.bigint :revenue_cents, null: false
      t.timestamps
      
      t.index [:company_id, :year, :month], unique: true, name: 'index_company_monthly_financials_on_company_year_month'
      t.index [:company_id], name: 'index_company_monthly_financial_reports_on_company_id'
    end
  end
end
