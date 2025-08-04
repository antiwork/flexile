class RemoveBoardConsentsAndMembers < ActiveRecord::Migration[8.0]
  def change
    drop_table :board_consents, if_exists: true
    remove_column :company_administrators, :board_member, if_exists: true
    drop_enum :board_consent_status
  end
end
