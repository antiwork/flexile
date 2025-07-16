class CreateLiquidationPayouts < ActiveRecord::Migration[8.0]
  def change
    create_table :liquidation_payouts do |t|
      t.bigint :liquidation_scenario_id, null: false
      t.bigint :company_investor_id, null: false
      t.string :share_class
      t.string :security_type, null: false
      t.bigint :number_of_shares
      t.bigint :payout_amount_cents, null: false
      t.decimal :liquidation_preference_amount
      t.decimal :participation_amount
      t.decimal :common_proceeds_amount

      t.timestamps default: -> { "CURRENT_TIMESTAMP" }, null: false
    end

    add_index :liquidation_payouts, :liquidation_scenario_id
    add_index :liquidation_payouts, :company_investor_id
    add_foreign_key :liquidation_payouts, :liquidation_scenarios
    add_foreign_key :liquidation_payouts, :company_investors
  end
end
