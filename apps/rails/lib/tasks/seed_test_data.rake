# frozen_string_literal: true

namespace :db do
  desc "Seed test data"
  task seed_test_data: :environment do
    WiseCredential.create!(profile_id: WISE_PROFILE_ID, api_key: WISE_API_KEY)
    ActiveRecord::Base.connection.exec_query("INSERT INTO document_templates(name, external_id, created_at, updated_at, document_type, docuseal_id, signable) VALUES('Consulting agreement', 'isz30o7a9e3sm', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1, true)")
    puts "Test data seeded"
  end
end
