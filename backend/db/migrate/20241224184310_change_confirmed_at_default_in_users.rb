class ChangeConfirmedAtDefaultInUsers < ActiveRecord::Migration[7.2]
  def change
    change_column_default :users, :confirmed_at, from: nil, to: -> { 'CURRENT_TIMESTAMP' }
    change_column_null :users, :confirmed_at, false, -> { "created_at" }
  end
end
