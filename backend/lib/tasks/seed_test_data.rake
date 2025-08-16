# frozen_string_literal: true

namespace :db do
  desc "Seed test data"
  task seed_test_data: :environment do
    profile_id = ENV.fetch("WISE_PROFILE_ID", "local_test")
    api_key    = ENV.fetch("WISE_API_KEY",  "local_test")

    puts "DEBUG: Creating WiseCredential with profile_id='#{profile_id}', api_key='#{api_key}'"

    WiseCredential.create!(
      profile_id: profile_id,
      api_key: api_key
    )

    puts "Test data seeded: WiseCredential created successfully"
  end
end
