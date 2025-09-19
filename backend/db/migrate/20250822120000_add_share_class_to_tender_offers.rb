class AddShareClassToTenderOffers < ActiveRecord::Migration[7.1]
  def change
    add_column :tender_offers, :share_class, :string, null: false, default: 'Vested shares from equity grants'
  end
end