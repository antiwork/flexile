#!/usr/bin/env ruby
# Quick script to create test users for impersonation testing

puts "🔧 Creating test users for impersonation system..."
puts ""

# Create admin user
admin = User.create!(
  email: "admin@flexile.test",
  legal_name: "Admin User",
  team_member: true,
  minimum_dividend_payment_in_cents: 0
)
puts "✅ Created admin user:"
puts "   Email: #{admin.email}"
puts "   ID: #{admin.external_id}"
puts "   Team Member: #{admin.team_member}"
puts ""

# Create regular user to impersonate
user = User.create!(
  email: "user@flexile.test",
  legal_name: "Test User",
  team_member: false,
  minimum_dividend_payment_in_cents: 0
)
puts "✅ Created regular user:"
puts "   Email: #{user.email}"
puts "   ID: #{user.external_id}"
puts "   Team Member: #{user.team_member}"
puts ""

# Create another user
user2 = User.create!(
  email: "john@flexile.test",
  legal_name: "John Doe",
  team_member: false,
  minimum_dividend_payment_in_cents: 0
)
puts "✅ Created another user:"
puts "   Email: #{user2.email}"
puts "   ID: #{user2.external_id}"
puts ""

puts "=" * 60
puts "✨ Test users created successfully!"
puts ""
puts "📝 Next steps:"
puts "1. Test the rake command:"
puts "   rails impersonation:generate_url[#{user.email}]"
puts ""
puts "2. Test the service directly:"
puts "   rails console"
puts "   Then run:"
puts "   user = User.find_by(email: '#{user.email}')"
puts "   token = ImpersonationService.generate_impersonation_url_token(user)"
puts "   puts token"
puts ""
puts "3. Access the app at http://localhost:3100"
puts "   (You'll need to set up authentication to log in)"
puts ""
