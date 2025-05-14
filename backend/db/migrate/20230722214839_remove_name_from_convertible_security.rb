class RemoveNameFromConvertibleSecurity < ActiveRecord::Migration[7.0]
  def change
    remove_column :convertible_securities, :name, :string, null: false
  end
end
