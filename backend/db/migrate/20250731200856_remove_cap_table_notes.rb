class RemoveCapTableNotes < ActiveRecord::Migration[7.2]
  def change
    remove_column :company_investors, :cap_table_notes, :string
    remove_column :company_investor_entities, :cap_table_notes, :string
  end
end
