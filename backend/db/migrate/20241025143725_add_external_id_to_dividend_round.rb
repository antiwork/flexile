class AddExternalIdToDividendRound < ActiveRecord::Migration[7.2]
  def change
    add_column :dividend_rounds, :external_id, :string
  end
end
