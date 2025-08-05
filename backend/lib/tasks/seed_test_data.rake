# frozen_string_literal: true

namespace :db do
  desc "Seed test data"
  task seed_test_data: :environment do
    WiseCredential.create!(profile_id: WISE_PROFILE_ID, api_key: WISE_API_KEY)
    puts "Test data seeded: WiseCredential created"
  end
end
