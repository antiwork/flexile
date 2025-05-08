class CreateTenderOffer < ActiveRecord::Migration[7.1]
  def change
    create_table :tender_offers do |t|
      t.belongs_to :company, null: false
      t.string :external_id, null: false, index: true
      t.integer :status, default: 0, null: false
      t.date :start_date, null: false
      t.date :end_date, null: false
      t.bigint :minimum_valuation, null: false
      t.bigint :number_of_shares, null: false
      t.integer :number_of_shareholders, null: false
      t.bigint :total_amount_in_cents, null: false

      t.timestamps
    end
  end
end
