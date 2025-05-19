class AddExternalIdToContractorProfile < ActiveRecord::Migration[7.1]
  def change
    add_column :contractor_profiles, :external_id, :string
  end
end
