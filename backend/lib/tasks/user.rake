# frozen_string_literal: true

namespace :user do
  desc "Generate a user impersonation URL"
  task :generate_impersonation_url, [:email] => :environment do |_task, args|
    unless args[:email].present?
      puts "Usage: rake user:generate_impersonation_url[email@example.com]"
      next
    end

    user = User.find_by(email: args[:email])

    if user
      signed_id = user.signed_id(expires_in: 5.minutes, purpose: :impersonate)
      url = Rails.application.routes.url_helpers.admin_create_impersonation_url(
        token: signed_id,
        host: Rails.application.config.action_mailer.default_url_options[:host]
      )
      puts "Here is the impersonation URL for #{user.email} (expires in 5 minutes):"
      puts url
    else
      puts "User with email '#{args[:email]}' not found."
    end
  end
end
