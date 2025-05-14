class AddShareClassToTenderOfferBid < ActiveRecord::Migration[7.1]
  def change
    add_column :tender_offer_bids, :share_class, :string, null: false
  end
end
