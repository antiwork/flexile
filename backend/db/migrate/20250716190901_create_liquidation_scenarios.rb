class CreateLiquidationScenarios < ActiveRecord::Migration[8.0]
  def change
    create_table :liquidation_scenarios do |t|
      t.bigint :company_id, null: false
      t.string :external_id, null: false
      t.string :name, null: false
      t.text :description
      t.bigint :exit_amount_cents, null: false
      t.date :exit_date, null: false
      t.string :status, default: "draft", null: false

      t.timestamps default: -> { "CURRENT_TIMESTAMP" }, null: false
    end

    add_index :liquidation_scenarios, :external_id, unique: true
    add_index :liquidation_scenarios, :company_id
    add_foreign_key :liquidation_scenarios, :companies
  end
end
