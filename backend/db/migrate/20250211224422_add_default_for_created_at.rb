class AddDefaultForCreatedAt < ActiveRecord::Migration[7.2]
  def change
    change_column_default :cap_table_uploads, :created_at, from: nil, to: -> { "CURRENT_TIMESTAMP" }
  end
end
