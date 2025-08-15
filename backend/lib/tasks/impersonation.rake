# frozen_string_literal: true

namespace :impersonation do
  desc "Generate impersonation URL for a user (admin only)"
  task :generate_url, [:email] => :environment do |_task, args|
    email = args[:email]

    if email.blank?
      puts "Usage: rails impersonation:generate_url[user@example.com]"
      exit 1
    end

    user = User.find_by(email: email)
    unless user
      puts "Error: User with email '#{email}' not found"
      exit 1
    end

    token = user.signed_id(purpose: :impersonate, expires_in: 5.minutes)
    host = Rails.application.config.action_mailer.default_url_options[:host]

    if host.blank?
      puts "Error: action_mailer.default_url_options[:host] not configured"
      puts "Set in config/environments/#{Rails.env}.rb or via environment variable"
      exit 1
    end

    url = "https://#{host}/admin/impersonate?token=#{token}"

    puts "Impersonation URL for #{user.display_name} (#{email}):"
    puts url
    puts
    puts "Note: URL expires in 5 minutes"
    puts "Only accessible by team members"
  end
end
