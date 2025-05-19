class AddInvestmentAmountInCentsToCompanyInvestor < ActiveRecord::Migration[7.0]
  def up
    add_column :company_investors, :investment_amount_in_cents, :bigint

    CompanyInvestor.reset_column_information
    CompanyInvestor.update_all(investment_amount_in_cents: 0)

    change_column_null :company_investors, :investment_amount_in_cents, false
  end

  def down
    remove_column :company_investors, :investment_amount_in_cents
  end
end
