class AddImpliedSharesToConvertibleSecurity < ActiveRecord::Migration[7.0]
  def change
    add_column :convertible_securities, :implied_shares, :decimal
  end
end
