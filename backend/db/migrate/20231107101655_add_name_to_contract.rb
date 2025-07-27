class AddNameToContract < ActiveRecord::Migration[7.1]
  def up
    add_column :contracts, :name, :string

    execute <<-SQL
      UPDATE contracts SET name = 'Consulting agreement'
    SQL

    change_column_null :contracts, :name, false
  end

  def down
    remove_column :contracts, :name
  end
end
