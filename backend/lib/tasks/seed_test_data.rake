# frozen_string_literal: true

namespace :db do
  desc "Seed test data"
  task seed_test_data: :environment do
    # Guard against accidental production usage
    abort("ERROR: db:seed_test_data is disabled in production") if Rails.env.production?

    profile_id = ENV.fetch("WISE_PROFILE_ID", "local_test")
    api_key    = ENV.fetch("WISE_API_KEY",  "local_test")

    # Mask sensitive information in logs
    masked_api_key = api_key.to_s.gsub(/.(?=.{4})/, "*") if api_key
    Rails.logger.debug("Creating WiseCredential with profile_id='#{profile_id}', api_key='#{masked_api_key}'") if Rails.env.development?

    WiseCredential.create!(
      profile_id: profile_id,
      api_key: api_key
    )

    puts "Test data seeded: WiseCredential created successfully"
  end
end
