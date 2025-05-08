class CreatePayments < ActiveRecord::Migration[7.0]
  def change
    create_table :payments do |t|
      t.references :invoice, null: false, index: true
      t.datetime :sent_at
      t.string :status, null: false

      t.timestamps
    end
  end
end
