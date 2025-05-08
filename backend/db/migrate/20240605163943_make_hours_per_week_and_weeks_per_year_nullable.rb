class MakeHoursPerWeekAndWeeksPerYearNullable < ActiveRecord::Migration[7.1]
  def change
    change_column_null :company_role_applications, :hours_per_week, true
    change_column_null :company_role_applications, :weeks_per_year, true
  end
end
