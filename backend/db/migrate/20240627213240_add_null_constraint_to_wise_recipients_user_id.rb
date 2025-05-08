class AddNullConstraintToWiseRecipientsUserId < ActiveRecord::Migration[7.1]
  def change
    change_column_null :wise_recipients, :user_id, false
  end
end
