class RemoveBoardConsentsAndMembers < ActiveRecord::Migration[8.0]
  def change
    # Drop board_consents table
    drop_table :board_consents, if_exists: true
    
    # Remove board_member field from company_administrators
    remove_column :company_administrators, :board_member, if_exists: true
    
    # Drop board_consent_status enum
    execute "DROP TYPE IF EXISTS board_consent_status"
    
    # Remove board_member from equity_grants_issue_date_relationship enum
    # Note: Cannot directly remove value from enum in PostgreSQL
    # Would need to create a new enum without board_member and migrate data
    # This part requires more complex migration and should be handled separately
  end
end
