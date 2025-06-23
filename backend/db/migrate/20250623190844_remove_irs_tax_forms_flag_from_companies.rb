class RemoveIrsTaxFormsFlagFromCompanies < ActiveRecord::Migration[8.0]
  def change
    remove_column :companies, :irs_tax_forms, :boolean, default: false, null: false
  end
end
