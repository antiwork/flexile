class ReplaceJsonDataWithOptionExercisingEnabled < ActiveRecord::Migration[8.0]
  def up
    # Add the new column if it doesn't exist
    unless column_exists?(:companies, :option_exercising_enabled)
      add_column :companies, :option_exercising_enabled, :boolean, default: false, null: false
    end

    # Set option_exercising_enabled to true for companies that had the option_exercising flag
    if column_exists?(:companies, :json_data)
      execute <<-SQL
        UPDATE companies
        SET option_exercising_enabled = true
        WHERE json_data->>'flags' ? 'option_exercising'
      SQL

      # Remove the old json_data column
      remove_column :companies, :json_data, :jsonb
    end
  end

  def down
    # Recreate the json_data column
    add_column :companies, :json_data, :jsonb, default: {"flags" => []}, null: false

    # Restore the option_exercising flag for companies that had option_exercising_enabled = true
    execute <<-SQL
      UPDATE companies
      SET json_data = jsonb_build_object('flags', ARRAY['option_exercising'])
      WHERE option_exercising_enabled = true
    SQL

    # Remove the new column
    remove_column :companies, :option_exercising_enabled, :boolean
  end
end
