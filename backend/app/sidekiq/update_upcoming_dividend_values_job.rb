# frozen_string_literal: true

class UpdateUpcomingDividendValuesJob
  include Sidekiq::Worker
  sidekiq_options retry: 5

  def perform(company_id)
    company = Company.find(company_id)
    UpcomingDividendCalculator.new(company, amount_in_usd: company.upcoming_dividend_cents / 100.to_d).process
  end
end
