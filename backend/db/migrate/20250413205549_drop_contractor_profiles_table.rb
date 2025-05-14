class DropContractorProfilesTable < ActiveRecord::Migration[8.0]
  def change
    drop_table :contractor_profiles
  end
end
