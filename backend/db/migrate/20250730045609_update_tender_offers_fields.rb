class UpdateTenderOffersFields < ActiveRecord::Migration[8.0]
  def change
    add_column :tender_offers, :letter_of_transmittal, :text, null: true
    add_column :tender_offers, :minimum_share_price_cents, :integer, null: false, default: 0
    change_column_default :tender_offers, :minimum_valuation, 0
  end
end
