class CreateVestingEvents < ActiveRecord::Migration[7.2]
  def change
    create_table :vesting_events do |t|
      t.string :external_id, null: false, index: { unique: true }
      t.references :equity_grant, null: false
      t.datetime :vesting_date, null: false
      t.bigint :vested_shares, null: false
      t.datetime :processed_at
      t.datetime :cancelled_at
      t.string :cancellation_reason
      t.timestamps
    end
  end
end
