class RemoveFinancingRounds < ActiveRecord::Migration[8.0]
  def change
    drop_table :financing_rounds
    remove_column :companies, :financing_rounds_enabled
  end
end
