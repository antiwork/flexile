class RemoveShowContractorListToContractors < ActiveRecord::Migration[7.0]
  def change
    remove_column :companies, :show_contractor_list_to_contractors, :boolean
  end
end
