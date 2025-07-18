class AddStartingPricePerShareCentsAndTypeToTenderOffers < ActiveRecord::Migration[8.0]
  def change
    create_enum :tender_offer_buyback_type, ["single_stock", "tender_offer"]

    add_column :tender_offers, :starting_price_per_share_cents, :integer
    add_column :tender_offers, :buyback_type, :enum, enum_type: :tender_offer_buyback_type, null: false, default: "tender_offer"
  end
end
