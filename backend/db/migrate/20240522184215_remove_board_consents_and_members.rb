class RemoveBoardConsentsAndMembers < ActiveRecord::Migration[8.0]
  def change
    drop_table :board_consents
    remove_column :company_administrators, :board_member
    drop_enum :board_consent_status
  end
end
