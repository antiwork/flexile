class AddJsonDataToContract < ActiveRecord::Migration[7.1]
  def change
    add_column :contracts, :json_data, :jsonb
  end
end
