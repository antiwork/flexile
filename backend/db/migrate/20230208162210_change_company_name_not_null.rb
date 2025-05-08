class ChangeCompanyNameNotNull < ActiveRecord::Migration[7.0]
  def change
    change_column_null :companies, :name, true
  end
end
