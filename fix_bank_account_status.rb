#!/usr/bin/env ruby

# Script to manually fix bank account status for onboarding completion
# Run this in the backend directory: ruby fix_bank_account_status.rb

require_relative 'backend/config/environment'

puts "=== Fix Bank Account Status Script ==="
puts

# Find your company (update with your email)
company_email = "your-email@example.com" # Replace with your actual email
company = Company.find_by(email: company_email)

if company.nil?
  puts "❌ Company not found. Please update the email in this script."
  exit 1
end

puts "🏢 Company: #{company.name} (ID: #{company.id})"
puts

# Check current status
if company.bank_account.present?
  stripe_account = company.bank_account
  puts "Current status: #{stripe_account.status}"
  puts "Ready?: #{stripe_account.ready?}"
  puts "Last 4 digits: #{stripe_account.bank_account_last_four}"

  if stripe_account.ready?
    puts "✅ Bank account is already ready!"
  else
    puts "⚠️  Bank account is not ready. Attempting to fix..."

    # Try to fetch the last 4 digits from Stripe if not set
    if stripe_account.bank_account_last_four.blank?
      begin
        last_four = stripe_account.fetch_stripe_bank_account_last_four
        if last_four
          stripe_account.bank_account_last_four = last_four
          puts "📝 Updated last 4 digits to: #{last_four}"
        end
      rescue => e
        puts "⚠️  Could not fetch last 4 digits from Stripe: #{e.message}"
      end
    end

    # Update status to ready
    stripe_account.update!(status: 'ready')
    puts "✅ Updated status to 'ready'"

    # Verify the fix
    company.reload
    puts "✅ bank_account_ready?: #{company.bank_account_ready?}"

    # Check onboarding completion
    admin = company.company_administrators.first&.user
    if admin
      completion_percentage = company.checklist_completion_percentage(admin)
      puts "📊 Onboarding completion: #{completion_percentage}%"
    end
  end
else
  puts "❌ No bank account record found"
  puts "You may need to connect a bank account first through the UI"
end

puts
puts "=== Next Steps ==="
puts "1. Refresh your browser"
puts "2. Check if the onboarding checklist now shows the bank account as complete"
puts "3. If you still see issues, the bank account may need to be reconnected"
