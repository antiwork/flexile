class CreateEquityAllocation < ActiveRecord::Migration[7.1]
  def change
    create_table :equity_allocations do |t|
      t.references :company_contractor, null: false
      t.integer :equity_percentage
      t.integer :year, null: false
      t.bigint :flags, null: false, default: 0

      t.timestamps
    end

    add_index :equity_allocations, %i[company_contractor_id year], unique: true
  end
end
