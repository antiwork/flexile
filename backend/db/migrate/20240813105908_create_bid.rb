class CreateBid < ActiveRecord::Migration[7.1]
  def change
    create_table :bids do |t|
      t.string :external_id, null: false
      t.references :tender_offer, null: false
      t.references :company_investor, null: false
      t.integer :number_of_shares, null: false
      t.integer :share_price_cents, null: false

      t.timestamps
    end
  end
end
