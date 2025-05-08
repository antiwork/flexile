class ModifyConvertibleInvestment < ActiveRecord::Migration[7.0]
  def change
    add_column :convertible_investments, :identifier, :string, null: false
    add_column :convertible_investments, :entity_name, :string, null: false
    add_column :convertible_investments, :issued_at, :datetime, null: false
  end
end
