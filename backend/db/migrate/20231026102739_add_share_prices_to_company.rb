class AddSharePricesToCompany < ActiveRecord::Migration[7.1]
  def change
    change_table :companies do |t|
      t.decimal :share_price_in_usd
      t.decimal :fmv_per_share_in_usd
    end
  end
end
