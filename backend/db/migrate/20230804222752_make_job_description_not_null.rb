class MakeJobDescriptionNotNull < ActiveRecord::Migration[7.0]
  def change
    execute("UPDATE company_roles SET job_description = name WHERE job_description IS NULL")

    change_column_null :company_roles, :job_description, false
  end
end
