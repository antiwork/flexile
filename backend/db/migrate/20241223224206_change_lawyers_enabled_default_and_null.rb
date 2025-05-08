class ChangeLawyersEnabledDefaultAndNull < ActiveRecord::Migration[7.2]
  def change
    change_column_default :companies, :lawyers_enabled, from: nil, to: false
    change_column_null :companies, :lawyers_enabled, false, false
  end
end
