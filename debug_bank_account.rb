#!/usr/bin/env ruby

# Debug script to check bank account status and onboarding completion
# Run this in the backend directory: ruby debug_bank_account.rb <email_or_id>

require_relative 'backend/config/environment'

puts "=== Bank Account Debug Script ==="
puts

# Accept company identifier from command line
if ARGV.empty?
  puts "Usage: ruby debug_bank_account.rb <email_or_id>"
  puts "Example: ruby debug_bank_account.rb user@example.com"
  puts "Example: ruby debug_bank_account.rb 123"
  exit 1
end

identifier = ARGV[0]
company = if identifier =~ /\A\d+\z/
            Company.find_by(id: identifier.to_i)
          else
            Company.find_by(email: identifier)
          end

if company.nil?
  puts "❌ Company not found. Please check the email or ID provided."
  puts "Available companies:"
  Company.limit(5).each do |c|
    puts "  - ID: #{c.id}, Email: #{c.email}, Name: #{c.name}"
  end
  exit 1
end

puts "🏢 Company: #{company.name} (ID: #{company.id})"
puts "📧 Email: #{company.email}"
puts

# Check bank account status
puts "=== Bank Account Status ==="
if company.bank_account.present?
  stripe_account = company.bank_account
  puts "✅ Bank account record exists"
  puts "   Status: #{stripe_account.status}"
  puts "   Last 4 digits: #{stripe_account.bank_account_last_four}"
  puts "   Setup Intent ID: #{stripe_account.setup_intent_id}"
  puts "   Ready?: #{stripe_account.ready?}"
  puts "   Initial setup completed?: #{stripe_account.initial_setup_completed?}"
else
  puts "❌ No bank account record found"
end

puts
puts "=== Company Bank Account Methods ==="
puts "bank_account_ready?: #{company.bank_account_ready?}"
puts "bank_account_added?: #{company.bank_account_added?}"
puts

# Check onboarding checklist for administrators
puts "=== Onboarding Checklist (Admin) ==="
admin = company.company_administrators.first&.user
if admin
  puts "👤 Admin: #{admin.name} (#{admin.email})"

  checklist_items = company.checklist_items(admin)
  checklist_items.each do |item|
    status = item[:completed] ? "✅" : "❌"
    puts "   #{status} #{item[:title]}: #{item[:completed]}"
  end

  completion_percentage = company.checklist_completion_percentage(admin)
  puts "   📊 Completion: #{completion_percentage}%"
else
  puts "❌ No company administrator found"
end

puts
puts "=== All Company Stripe Accounts ==="
company.company_stripe_accounts.each do |account|
  puts "   ID: #{account.id}"
  puts "   Status: #{account.status}"
  puts "   Last 4: #{account.bank_account_last_four}"
  puts "   Setup Intent: #{account.setup_intent_id}"
  puts "   Deleted: #{account.deleted?}"
  puts "   Created: #{account.created_at}"
  puts "   ---"
end

puts
puts "=== Debugging Steps ==="
puts "If the bank account shows as connected but onboarding isn't complete:"
puts "1. Check if the CompanyStripeAccount status is 'ready'"
puts "2. If status is not 'ready', the Stripe webhook may not have processed"
puts "3. You may need to manually update the status or re-process the setup intent"
puts
puts "To manually fix (if needed - USE WITH CAUTION IN PRODUCTION):"
puts "# company.bank_account.update!(status: 'ready') if company.bank_account"
puts "# Consider using fix_bank_account_status.rb script instead for safer updates"