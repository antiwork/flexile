class AddSlackUserIdToCompanyContractors < ActiveRecord::Migration[8.0]
  def change
    add_column :company_contractors, :slack_user_id, :string
  end
end
