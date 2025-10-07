# frozen_string_literal: true

namespace :impersonation do
  desc "Generate impersonation URL for a user by email (admin only)"
  task :generate_url, [:email] => :environment do |_task, args|
    email = args[:email]
    
    if email.blank?
      puts "Error: Email is required"
      puts "Usage: rails impersonation:generate_url[user@example.com]"
      exit 1
    end

    user = User.find_by(email: email)
    unless user
      puts "Error: User with email '#{email}' not found"
      exit 1
    end

    # Generate impersonation URL
    token = ImpersonationService.generate_impersonation_url_token(user)
    base_url = ENV.fetch('FRONTEND_URL', 'http://localhost:3100')
    impersonation_url = "#{base_url}/impersonate?token=#{token}"

    puts "Impersonation URL generated for #{user.display_name} (#{email}):"
    puts impersonation_url
    puts ""
    puts "This URL will expire in 5 minutes."
    puts "Once used, the impersonation session will last 15 minutes."
  end
end
