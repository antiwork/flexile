class DropCapTableUploads < ActiveRecord::Migration[8.0]
  def change
    drop_table :cap_table_uploads, if_exists: true
  end
end
