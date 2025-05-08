class RemoveValuationFromConvertibleSecurities < ActiveRecord::Migration[7.0]
  def up
    remove_column :convertible_securities, :company_valuation_in_dollars
  end

  def down
    add_column :convertible_securities, :company_valuation_in_dollars, :bigint

    ConvertibleSecurity.reset_column_information
    ConvertibleSecurity.includes(:convertible_investment).each do |security|
      security.update!(company_valuation_in_dollars: security.convertible_investment.company_valuation_in_dollars)
    end

    change_column_null :convertible_securities, :company_valuation_in_dollars, false
  end
end
