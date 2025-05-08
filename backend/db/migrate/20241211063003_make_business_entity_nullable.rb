class MakeBusinessEntityNullable < ActiveRecord::Migration[7.2]
  def change
    change_column_null :user_compliance_infos, :business_entity, true
  end
end
