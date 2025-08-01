# frozen_string_literal: true

# Script to set up test data for the contractor email feature
# Run this with: bundle exec rails runner setup_test_data.rb

puts "Setting up test data for contractor email feature..."

# Get the first company (should be Flexile Demo Company based on your screenshot)
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

# Get or create admin user (you)
admin_user = User.find_by(email: "hi@example.com") || User.first
if admin_user.nil?
  puts "No admin user found!"
  exit
end

puts "Admin user: #{admin_user.email}"

# Create some contractors
puts "\nCreating contractors..."

# Active contractor with high billing
contractor1 = User.find_or_create_by!(email: "contractor1@example.com") do |u|
  u.legal_name = "Alice Johnson"
end

cc1 = CompanyContractor.find_or_create_by!(
  company: company,
  user: contractor1
) do |cc|
  cc.role = "Frontend Developer"
  cc.started_at = 3.months.ago
end

# Create invoices for contractor1 (total: $2,500)
Invoice.find_or_create_by!(
  company_id: company.id,
  company_contractor_id: cc1.id,
  external_id: "INV-001"
) do |inv|
  inv.total_amount_in_usd_cents = 150000 # $1,500
  inv.status = "paid"
  inv.invoice_date = 2.months.ago
end

Invoice.find_or_create_by!(
  company_id: company.id,
  company_contractor_id: cc1.id,
  external_id: "INV-002"
) do |inv|
  inv.total_amount_in_usd_cents = 100000 # $1,000
  inv.status = "paid"
  inv.invoice_date = 1.month.ago
end

# Active contractor with low billing
contractor2 = User.find_or_create_by!(email: "contractor2@example.com") do |u|
  u.legal_name = "Bob Smith"
end

cc2 = CompanyContractor.find_or_create_by!(
  company: company,
  user: contractor2
) do |cc|
  cc.role = "Backend Developer"
  cc.started_at = 2.months.ago
end

# Create invoice for contractor2 (total: $500)
Invoice.find_or_create_by!(
  company_id: company.id,
  company_contractor_id: cc2.id,
  external_id: "INV-003"
) do |inv|
  inv.total_amount_in_usd_cents = 50000 # $500
  inv.status = "paid"
  inv.invoice_date = 1.month.ago
end

# Alumni contractor (terminated)
contractor3 = User.find_or_create_by!(email: "contractor3@example.com") do |u|
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
puts "  - Alice Johnson (Active, $2,500 billed)"
puts "  - Bob Smith (Active, $500 billed)"
puts "  - Charlie Brown (Alumni)"

# Create investors
puts "\nCreating investors..."

# Angel investor
investor1 = User.find_or_create_by!(email: "investor1@example.com") do |u|
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
investor2 = User.find_or_create_by!(email: "investor2@example.com") do |u|
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
dual_user = User.find_or_create_by!(email: "dual@example.com") do |u|
  u.legal_name = "Frank Dual"
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
puts "\nYou can now test the feature by:"
puts "1. Going to http://localhost:3001"
puts "2. Click on 'Updates' in the sidebar"
puts "3. Click on 'Company Updates'"
puts "4. Create a new update and test the recipient selector"
