# frozen_string_literal: true

class UpdateUpcomingDividendsJob
  include Sidekiq::Worker
  sidekiq_options retry: 5

  def perform
    Flipper.feature(:upcoming_dividend).actors_value.each do |flipper_id|
      next unless flipper_id.match?(/\ACompany;\d+\z/)

      company = Company.find(flipper_id.split(";").last)
      next unless company.upcoming_dividend_cents?

      UpdateUpcomingDividendValuesJob.perform_async(company.id)
    end
  end
end
