# frozen_string_literal: true

class TransferFromStripeToWiseJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform
    eligible_records.find_each do |consolidated_payment|
      create_payout_for_consolidated_payment_if_possible(consolidated_payment)
    end
  end

  private
    def create_payout_for_consolidated_payment_if_possible(consolidated_payment)
      CreatePayoutForConsolidatedPayment.new(consolidated_payment).perform!
    rescue CreatePayoutForConsolidatedPayment::Error
      # do nothing
    end

    def eligible_records
      ConsolidatedPayment.where(stripe_payout_id: nil).where("trigger_payout_after < ?", Time.current)
    end
end
