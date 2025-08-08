class AddOtpFieldsToUser < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :otp_secret_key, :string
    add_column :users, :otp_failed_attempts_count, :integer, default: 0, null: false
    add_column :users, :otp_first_failed_at, :datetime
  end
end
