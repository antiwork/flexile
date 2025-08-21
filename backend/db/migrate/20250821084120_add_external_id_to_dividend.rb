class AddExternalIdToDividend < ActiveRecord::Migration[8.0]
  def change
    add_column :dividends, :external_id, :string
  end
end
