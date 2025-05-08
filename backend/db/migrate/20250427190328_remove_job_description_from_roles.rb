class RemoveJobDescriptionFromRoles < ActiveRecord::Migration[8.0]
  def change
    remove_column :company_roles, :job_description
  end
end
