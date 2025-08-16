# frozen_string_literal: true

class AutoEnableDividendPaymentsJob
  include Sidekiq::Job

  def perform
    # Find dividend rounds that should be ready for payment today
    dividend_rounds_to_enable = DividendRound.joins(:company)
                                           .where(ready_for_payment: false)
                                           .where(status: "Issued")
                                           .where("issued_at <= ?", Date.current)
                                           .where(companies: { dividends_allowed: true })

    count = 0
    dividend_rounds_to_enable.find_each do |dividend_round|
      Rails.logger.info "Auto-enabling payment for dividend round #{dividend_round.id} (issued_at: #{dividend_round.issued_at})"

      dividend_round.update!(ready_for_payment: true)
      count += 1
    end

    Rails.logger.info "Auto-enabled payment for #{count} dividend rounds"
  end
end
