class CreateContractorServiceFees < ActiveRecord::Migration[7.1]
  def change
    create_table :contractor_service_fees do |t|
      t.references :user, null: false, index: true
      t.references :company, null: false, index: true
      t.references :consolidated_invoice, null: false, index: true
      t.integer :month, null: false
      t.integer :year, null: false
      t.integer :service_fee_cents, null: false

      t.timestamps
    end
  end
end
