class AddFullyDilutedSharesToCompany < ActiveRecord::Migration[7.0]
  def change
    add_column :companies, :fully_diluted_shares, :bigint, default: 0, null: false
  end
end
