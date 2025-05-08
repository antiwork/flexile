class AddFlagsToContract < ActiveRecord::Migration[7.1]
  def change
    add_column :contracts, :flags, :bigint, default: 0, null: false
  end
end
