# frozen_string_literal: true

class EnableCitextAndMakeEmailCaseInsensitive < ActiveRecord::Migration[8.0]
  def up
    # Enable the citext extension for case-insensitive text
    enable_extension "citext"

    # Normalize all existing emails to lowercase before changing column type
    User.find_each do |user|
      next if user.email.blank?

      downcased_email = user.email.downcase
      next if user.email == downcased_email

      user.update_column(:email, downcased_email)
    end

    # Change email column to citext for case-insensitive comparisons
    change_column :users, :email, :citext
  end

  def down
    # Revert email column back to string
    change_column :users, :email, :string

    # Disable the citext extension
    disable_extension "citext"
  end
end
