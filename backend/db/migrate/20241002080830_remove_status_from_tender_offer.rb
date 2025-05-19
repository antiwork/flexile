class RemoveStatusFromTenderOffer < ActiveRecord::Migration[7.2]
  def change
    remove_column :tender_offers, :status, :integer, default: 0, null: false
  end
end
