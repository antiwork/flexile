class AddNameToTenderOffers < ActiveRecord::Migration[8.0]
  def change
    add_column :tender_offers, :name, :string, null: true, default: nil
  end
end