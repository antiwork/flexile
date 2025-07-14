class DropContractsTable < ActiveRecord::Migration[8.0]
  def up
    drop_table :contracts, if_exists: true
  end

  def down
    # Recreation not recommended - data loss
    raise ActiveRecord::IrreversibleMigration
  end
end
