class AddUniqueToTenderOfferExternalId < ActiveRecord::Migration[7.2]
  def change
    remove_index :tender_offers, :external_id
    add_index :tender_offers, :external_id, unique: true
    add_index :tender_offer_bids, :external_id, unique: true
  end
end
