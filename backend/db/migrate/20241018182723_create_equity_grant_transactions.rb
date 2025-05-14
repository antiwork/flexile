class CreateEquityGrantTransactions < ActiveRecord::Migration[7.2]
  def change
    create_enum :equity_grant_transactions_transaction_type, %w[scheduled_vesting vesting_post_invoice_payment exercise cancellation manual_adjustment]
    create_table :equity_grant_transactions do |t|
      t.string :external_id, null: false, index: { unique: true }
      t.references :equity_grant, null: false
      t.enum :transaction_type, enum_type: :equity_grant_transactions_transaction_type, null: false
      t.references :vesting_event
      t.references :invoice
      t.references :equity_grant_exercise
      t.jsonb :metadata, default: {}, null: false
      t.text :notes
      t.bigint :vested_shares, null: false, default: 0
      t.bigint :exercised_shares, null: false, default: 0
      t.bigint :forfeited_shares, null: false, default: 0
      t.bigint :total_number_of_shares, null: false
      t.bigint :total_vested_shares, null: false
      t.bigint :total_unvested_shares, null: false
      t.bigint :total_exercised_shares, null: false
      t.bigint :total_forfeited_shares, null: false
      t.timestamps
    end

    add_index :equity_grant_transactions, [:equity_grant_id, :transaction_type, :vesting_event_id, :invoice_id, :equity_grant_exercise_id], unique: true, name: "idx_equity_grant_transactions_on_all_columns"
  end
end
