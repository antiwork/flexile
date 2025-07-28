# frozen_string_literal: true

class MarkDividendRoundsReadyForPaymentJob
  include Sidekiq::Job
  sidekiq_options retry: 3

  def perform
    dividend_rounds_to_update = DividendRound
      .where(ready_for_payment: false)
      .where("issued_at <= ?", Date.current)

    count = dividend_rounds_to_update.update_all(ready_for_payment: true)

    Rails.logger.info("MarkDividendRoundsReadyForPaymentJob: Updated #{count} dividend rounds to ready_for_payment: true")
  end
end
