# frozen_string_literal: true

# Simplified script to set up test data for the contractor email feature
# Run this with: bundle exec rails runner simple_test_data.rb

puts "Setting up test data for contractor email feature..."

# Get the first company
company = Company.first
if company.nil?
  puts "No company found! Please run seeds first."
  exit
end

puts "Using company: #{company.name}"

# Enable company updates feature flag
if !Flipper.enabled?(:company_updates, company)
  puts "Enabling Updates feature for the company..."
  Flipper.enable(:company_updates, company)
end

# Get admin user
admin_user = User.first
puts "Admin user: #{admin_user.email}"

# Create contractors
puts "\nCreating contractors..."

# Active contractor 1
contractor1 = User.find_or_create_by!(email: "alice.contractor@example.com") do |u|
  u.legal_name = "Alice Johnson"
end

CompanyContractor.find_or_create_by!(
  company: company,
  user: contractor1
) do |cc|
  cc.role = "Frontend Developer"
  cc.started_at = 3.months.ago
end

# Active contractor 2
contractor2 = User.find_or_create_by!(email: "bob.contractor@example.com") do |u|
  u.legal_name = "Bob Smith"
end

CompanyContractor.find_or_create_by!(
  company: company,
  user: contractor2
) do |cc|
  cc.role = "Backend Developer"
  cc.started_at = 2.months.ago
end

# Alumni contractor (terminated)
contractor3 = User.find_or_create_by!(email: "charlie.alumni@example.com") do |u|
  u.legal_name = "Charlie Brown"
end

CompanyContractor.find_or_create_by!(
  company: company,
  user: contractor3
) do |cc|
  cc.role = "Designer"
  cc.started_at = 6.months.ago
  cc.ended_at = 1.month.ago
end

puts "Created contractors:"
puts "  - Alice Johnson (Active)"
puts "  - Bob Smith (Active)"
puts "  - Charlie Brown (Alumni)"

# Create investors
puts "\nCreating investors..."

# Angel investor
investor1 = User.find_or_create_by!(email: "david.investor@example.com") do |u|
  u.legal_name = "David Angel"
end

CompanyInvestor.find_or_create_by!(
  company: company,
  user: investor1
) do |ci|
  ci.investment_amount_in_cents = 10000000 # $100,000
  ci.total_shares = 1000
  ci.investor_type = "angel"
end

# VC investor
investor2 = User.find_or_create_by!(email: "emma.investor@example.com") do |u|
  u.legal_name = "Emma Venture"
end

CompanyInvestor.find_or_create_by!(
  company: company,
  user: investor2
) do |ci|
  ci.investment_amount_in_cents = 50000000 # $500,000
  ci.total_shares = 5000
  ci.investor_type = "vc"
end

# Create a user who is both contractor AND investor (for testing de-duplication)
dual_user = User.find_or_create_by!(email: "frank.dual@example.com") do |u|
  u.legal_name = "Frank Dual (Contractor + Investor)"
end

CompanyContractor.find_or_create_by!(
  company: company,
  user: dual_user
) do |cc|
  cc.role = "Technical Advisor"
  cc.started_at = 4.months.ago
end

CompanyInvestor.find_or_create_by!(
  company: company,
  user: dual_user
) do |ci|
  ci.investment_amount_in_cents = 5000000 # $50,000
  ci.total_shares = 500
  ci.investor_type = "angel"
end

puts "Created investors:"
puts "  - David Angel (Angel investor, $100k)"
puts "  - Emma Venture (VC investor, $500k)"
puts "  - Frank Dual (Both contractor AND investor)"

# Summary
puts "\n=== Summary ==="
puts "Company: #{company.name}"
puts "Active contractors: #{company.contractors.active.count}"
puts "Alumni contractors: #{company.contractors.where.not(ended_at: nil).count}"
puts "Total contractors: #{company.contractors.count}"
puts "Investors: #{company.investors.count}"
puts "  - Angel investors: #{company.investors.where(investor_type: 'angel').count}"
puts "  - VC investors: #{company.investors.where(investor_type: 'vc').count}"
puts "Administrators: #{company.administrators.count}"

puts "\n✅ Test data setup complete!"
puts "\n📋 Test User Accounts Created:"
puts "  - alice.contractor@example.com (Active contractor)"
puts "  - bob.contractor@example.com (Active contractor)"
puts "  - charlie.alumni@example.com (Alumni contractor)"
puts "  - david.investor@example.com (Angel investor)"
puts "  - emma.investor@example.com (VC investor)"
puts "  - frank.dual@example.com (Both contractor AND investor)"
