class AddAcceptedSharesToTenderOfferBid < ActiveRecord::Migration[7.2]
  def change
    add_column :tender_offer_bids, :accepted_shares, :decimal, default: 0, null: false
  end
end
