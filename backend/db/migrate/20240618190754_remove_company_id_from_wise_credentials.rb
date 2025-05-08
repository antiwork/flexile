class RemoveCompanyIdFromWiseCredentials < ActiveRecord::Migration[7.1]
  def change
    remove_reference :wise_credentials, :company, index: true
  end
end
