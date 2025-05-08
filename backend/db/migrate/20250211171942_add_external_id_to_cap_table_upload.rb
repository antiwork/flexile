class AddExternalIdToCapTableUpload < ActiveRecord::Migration[7.2]
  def change
    add_column :cap_table_uploads, :external_id, :string, null: false
    add_index :cap_table_uploads, :external_id, unique: true
  end
end
