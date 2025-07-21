class AddImpliedValuationAndBuybackTypeToTenderOffers < ActiveRecord::Migration[8.0]
  def change
    create_enum :tender_offer_buyback_type, ["single_stock", "tender_offer"]

    add_column :tender_offers, :implied_valuation, :bigint, null: true
    add_column :tender_offers, :buyback_type, :enum, enum_type: :tender_offer_buyback_type, null: false, default: "tender_offer"
  end
end
