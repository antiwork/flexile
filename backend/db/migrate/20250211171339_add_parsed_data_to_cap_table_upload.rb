class AddParsedDataToCapTableUpload < ActiveRecord::Migration[7.2]
  def change
    add_column :cap_table_uploads, :parsed_data, :jsonb
  end
end
