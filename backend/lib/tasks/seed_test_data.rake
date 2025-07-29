# frozen_string_literal: true

namespace :db do
  desc "Seed test data"
  task seed_test_data: :environment do
    WiseCredential.create!(profile_id: WISE_PROFILE_ID, api_key: WISE_API_KEY)

    # Create test users for e2e tests
    test_emails = [
      "test1+e2e@example.com",
      "test2+e2e@example.com",
      "test3+e2e@example.com",
      "test4+e2e@example.com"
    ]

    test_emails.each do |email|
      # Skip if user already exists
      next if User.exists?(email: email)

      User.create!(
        email: email,
        confirmed_at: Time.current,
        invitation_accepted_at: Time.current,
        minimum_dividend_payment_in_cents: 0
      )
    end

    puts "Test data seeded: WiseCredential and #{test_emails.length} test users created"
  end
end
