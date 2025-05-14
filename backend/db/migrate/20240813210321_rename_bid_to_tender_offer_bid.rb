class RenameBidToTenderOfferBid < ActiveRecord::Migration[7.1]
  def change
    rename_table :bids, :tender_offer_bids
  end
end
