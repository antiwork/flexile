# frozen_string_literal: true

class AutoEnableDividendPaymentsJob
  include Sidekiq::Job
  sidekiq_options queue: :default, retry: 0

  def perform
    dividend_rounds_to_enable = DividendRound.joins(:company)
                                           .where(ready_for_payment: false)
                                           .where(status: "Issued")
                                           .where("issued_at < CURRENT_DATE + INTERVAL '1 day'")
                                           .where(companies: { dividends_allowed: true })

    count = 0
    failed_count = 0

    # TODO (techdebt): Consider implementing batch update with per-record error handling for better performance
    dividend_rounds_to_enable.in_batches.each_record do |dividend_round|
      Rails.logger.info "Auto-enabling payment for dividend round #{dividend_round.id} (issued_at: #{dividend_round.issued_at})"

      dividend_round.update_columns(ready_for_payment: true, updated_at: Time.current)
      count += 1
    rescue => e
      failed_count += 1
      Rails.logger.error "Failed to enable payment for dividend round #{dividend_round.id}: #{e.message}. " \
                        "Company: #{dividend_round.company_id}, issued_at: #{dividend_round.issued_at}, " \
                        "error_class: #{e.class.name}"
    end

    Rails.logger.info "Auto-enabled payment for #{count} dividend rounds#{failed_count > 0 ? ", #{failed_count} failed" : ""}"
  end
end
