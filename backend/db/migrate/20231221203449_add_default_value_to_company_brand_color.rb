class AddDefaultValueToCompanyBrandColor < ActiveRecord::Migration[7.1]
  def up
    change_table :companies do |t|
      t.remove :brand_color
      t.string :brand_color, default: "#000000", null: false
    end
  end
end
