class AddTermFieldsToConvertibleSecurities < ActiveRecord::Migration[8.0]
  def change
    add_column :convertible_securities, :valuation_cap_cents, :bigint
    add_column :convertible_securities, :discount_rate_percent, :decimal
    add_column :convertible_securities, :interest_rate_percent, :decimal
    add_column :convertible_securities, :maturity_date, :date
    add_column :convertible_securities, :seniority_rank, :integer, limit: 2
  end
end
