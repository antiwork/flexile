# frozen_string_literal: true

class ProcessPayoutForConsolidatedPaymentJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(consolidated_payment_id)
    self.consolidated_payment = ConsolidatedPayment.find(consolidated_payment_id)
    return if processed?

    payout = Stripe::Payout.retrieve(consolidated_payment.stripe_payout_id)
    consolidated_payment.with_lock do
      return if processed?

      # https://docs.stripe.com/api/payouts/object#payout_object-status
      case payout.status
      when "paid"
        process_as_paid!
      else
        raise "Unsupported payout status: #{payout.status}"
      end
    end
  end

  private
    attr_accessor :consolidated_payment

    def process_as_paid!
      consolidated_payment.update!(succeeded_at: Time.current)
      consolidated_invoice = consolidated_payment.consolidated_invoice
      consolidated_invoice.mark_as_paid!(timestamp: Time.current)
      consolidated_invoice.trigger_payments
    end

    def processed?
      # This only handles the case where the record was updated when a payout was paid, which indicates that
      # the record was "processed" by this job
      consolidated_payment.succeeded_at.present?
    end
end
