# frozen_string_literal: true

class AutoEnableDividendPaymentsJob
  include Sidekiq::Job

  def perform
    # Find dividend rounds that should be ready for payment today
    # Use DATE() function and CURRENT_DATE to avoid timezone edge cases
    dividend_rounds_to_enable = DividendRound.joins(:company)
                                           .where(ready_for_payment: false)
                                           .where(status: "Issued")
                                           .where("DATE(issued_at) <= CURRENT_DATE")
                                           .where(companies: { dividends_allowed: true })

    count = 0
    failed_count = 0
    
    # TODO: Consider implementing batch update with per-record error handling
    # for better performance with large datasets while maintaining error resilience
    dividend_rounds_to_enable.find_each do |dividend_round|
      begin
        Rails.logger.info "Auto-enabling payment for dividend round #{dividend_round.id} (issued_at: #{dividend_round.issued_at})"
        
        dividend_round.update!(ready_for_payment: true)
        count += 1
      rescue => e
        failed_count += 1
        Rails.logger.error "Failed to enable payment for dividend round #{dividend_round.id}: #{e.message}. " +
                          "Company: #{dividend_round.company_id}, issued_at: #{dividend_round.issued_at}, " +
                          "error_class: #{e.class.name}"
        # Continue processing other records even if one fails
      end
    end

    Rails.logger.info "Auto-enabled payment for #{count} dividend rounds" +
                     (failed_count > 0 ? ", #{failed_count} failed" : "")
  end
end
