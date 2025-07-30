class DropTimeEntries < ActiveRecord::Migration[8.0]
  def change
    drop_table :time_entries
  end
end
