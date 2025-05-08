class AddAcceptedPriceCentsToTenderOffer < ActiveRecord::Migration[7.2]
  def change
    add_column :tender_offers, :accepted_price_cents, :integer
  end
end
