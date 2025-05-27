class RemoveInvitingCompanyFlagFromUsers < ActiveRecord::Migration[8.0]
  def change
    remove_column :users, :inviting_company
  end
end
