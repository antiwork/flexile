# frozen_string_literal: true

FactoryBot.define do
  factory :tender_offer do
    company
    attachment { Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files/sample.zip")) }
    starts_at { 20.days.ago }
    ends_at { 10.days.from_now }
    minimum_valuation { 100_000 }
  end
end
