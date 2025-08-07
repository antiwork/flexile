class RemoveIsGumroadFromCompanies < ActiveRecord::Migration[8.0]
  def change
    if column_exists?(:companies, :is_gumroad)
      remove_column :companies, :is_gumroad, :boolean
    end
  end
end
