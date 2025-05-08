class AddValuationToCompany < ActiveRecord::Migration[7.0]
  def change
    add_column :companies, :valuation_in_dollars, :bigint, null: false, default: 0
  end
end
