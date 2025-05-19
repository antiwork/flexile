class AddFlagsToCompanies < ActiveRecord::Migration[7.0]
  def change
    add_column :companies, :flags, :bigint, default: 0, null: false
  end
end
