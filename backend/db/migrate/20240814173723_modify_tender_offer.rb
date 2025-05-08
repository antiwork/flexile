class ModifyTenderOffer < ActiveRecord::Migration[7.1]
  def change
    change_column_null :tender_offers, :total_amount_in_cents, true
    change_column_null :tender_offers, :number_of_shares, true
    change_column_null :tender_offers, :number_of_shareholders, true
  end
end
