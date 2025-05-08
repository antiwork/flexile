class RemoveDefaultFromCompanyBrandColor < ActiveRecord::Migration[7.1]
  def change
    change_column :companies, :brand_color, :string, default: nil, null: true
  end
end
