class ChangeTenderOfferBidNumberOfSharesToDecimal < ActiveRecord::Migration[7.1]
  def up
    change_column :tender_offer_bids, :number_of_shares, :decimal
  end

  def down
    change_column :tender_offer_bids, :number_of_shares, :integer
  end
end
