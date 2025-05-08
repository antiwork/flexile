class GenerateEquityAllocations < ActiveRecord::Migration[7.1]
  def up
    CompanyContractor.reset_column_information
    CompanyContractor.where.not(deprecated_equity_percentage: nil).each do |company_contractor|
      equity_percentage = company_contractor.deprecated_equity_percentage
      company_contractor.equity_allocations.create!(
        year: 2024,
        equity_percentage: equity_percentage,
      )
    end
  end

  def down
    # We can't know which ones we created and which ones users did, so we can't reverse this migration
    fail ActiveRecord::IrreversibleMigration
  end
end
