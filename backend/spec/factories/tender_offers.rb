# frozen_string_literal: true

FactoryBot.define do
  factory :tender_offer do
    company
    attachment { Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files/sample.zip")) }
    starts_at { 20.days.ago }
    ends_at { 10.days.from_now }
    minimum_valuation { 100_000 }
    letter_of_transmittal { "<h1>Letter of transmittal</h1>" }
  end
end
