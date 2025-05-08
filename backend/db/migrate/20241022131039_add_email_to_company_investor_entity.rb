class AddEmailToCompanyInvestorEntity < ActiveRecord::Migration[7.2]
  def change
    add_column :company_investor_entities, :email, :string, null: false
    add_index :company_investor_entities, [:company_id, :email, :name], unique: true
  end
end
