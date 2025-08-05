class SeedOtpSecretKeysForExistingUsers < ActiveRecord::Migration[8.0]
  def up

    # Only update users who don't have an OTP secret key set
    users_without_otp = User.where("otp_secret_key IS NULL OR otp_secret_key = ''")

    puts "Found #{users_without_otp.count} users without OTP secret keys"

    users_without_otp.find_each do |user|
      user.update!(otp_secret_key: User.otp_random_secret)
    end

    puts "Successfully seeded OTP secret keys for all users"
  end

  def down
    # This migration is irreversible for security reasons
    # OTP secret keys should not be removed once set
    puts "This migration cannot be reversed for security reasons"
  end
end
