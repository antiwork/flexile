class CreateTenderOfferInvestors < ActiveRecord::Migration[8.0]
  def change
    create_table :tender_offer_investors do |t|
      t.string :external_id, null: false
      t.references :tender_offer, null: false
      t.references :company_investor, null: false

      t.timestamps
    end

    change_column_default :tender_offer_investors, :created_at, from: nil, to: -> { "CURRENT_TIMESTAMP" }

    add_index :tender_offer_investors, :external_id, unique: true
    add_index :tender_offer_investors, [:tender_offer_id, :company_investor_id], unique: true, name: "idx_tender_offer_investors_unique"
  end
end