class ReplaceJsonDataWithOptionExercisingEnabled < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :option_exercising_enabled, :boolean, default: false, null: false

    # Set option_exercising_enabled to true for companies that had the option_exercising flag
    execute <<-SQL
      UPDATE companies
      SET option_exercising_enabled = true
      WHERE json_data->'flags' ? 'option_exercising'
    SQL
  end
end
