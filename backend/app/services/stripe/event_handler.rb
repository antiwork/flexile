# frozen_string_literal: true

class Stripe::EventHandler
  def initialize(stripe_event)
    @stripe_event = stripe_event
  end

  def process!
    Rails.logger.info "Processing Stripe event: #{stripe_event}"

    # https://docs.stripe.com/api/events/types
    case stripe_event.type
    when "setup_intent.succeeded"
      stripe_account = CompanyStripeAccount.find_by!(setup_intent_id: stripe_event.data.object.id)
      stripe_account.update!(
        status: CompanyStripeAccount::READY,
        bank_account_last_four: stripe_account.fetch_stripe_bank_account_last_four,
      )
    when "setup_intent.canceled"
      # TODO (helen): Also notify company that they need to re-authorize Stripe
      stripe_account = CompanyStripeAccount.find_by!(setup_intent_id: stripe_event.data.object.id)
      stripe_account.update!(status: CompanyStripeAccount::CANCELLED, deleted_at: Time.current)
      Bugsnag.notify("Stripe setup intent cancelled for company #{stripe_account.company.id} - stripe_event: #{stripe_event}")
    when "setup_intent.setup_failed"
      stripe_account = CompanyStripeAccount.find_by!(setup_intent_id: stripe_event.data.object.id)
      stripe_account.update!(status: CompanyStripeAccount::FAILED)
      company = stripe_account.company

      if error = stripe_event.data.object.last_setup_error
        stripe_account.mark_deleted!
        if error[:code] == "setup_intent_setup_attempt_expired"
          company.company_administrators.ids.each do
            CompanyMailer.stripe_microdeposit_verification_expired(admin_id: _1).deliver_later
          end
        end
      end

      Bugsnag.notify("Stripe setup intent did not succeed for company #{company.id} - stripe_event: #{stripe_event}")
    when "setup_intent.requires_action"
      stripe_account = CompanyStripeAccount.find_by!(setup_intent_id: stripe_event.data.object.id)
      stripe_account.update!(
        status: CompanyStripeAccount::ACTION_REQUIRED,
        bank_account_last_four: stripe_account.fetch_stripe_bank_account_last_four,
      )

      next_action = stripe_event.data.object.respond_to?(:next_action) ? stripe_event.data.object.next_action : nil
      company = stripe_account.company.reload
      if next_action.present? && next_action.type == "verify_with_microdeposits"
        company.company_administrators.ids.each do
          CompanyMailer.verify_stripe_microdeposits(admin_id: _1).deliver_later
        end
      end
    when "charge.refunded"
      process_charge_refunded!
    when "payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled"
      process_payment_intent
    when "payout.paid"
      process_payout_paid!
    end
  end

  private
    attr_reader :stripe_event

    def process_charge_refunded!
      consolidated_payment = ConsolidatedPayment.find_by!(stripe_payment_intent_id: stripe_event.data.object.payment_intent)
      consolidated_payment.mark_as_refunded!
    end

    def process_payment_intent
      consolidated_payment = ConsolidatedPayment.find_by!(stripe_payment_intent_id: stripe_event.data.object.id)
      ProcessConsolidatedPaymentJob.perform_async(consolidated_payment.id)
    end

    def process_payout_paid!
      # Ignore the event if the payout was not initiated by Flexile
      return if stripe_event.data.object.automatic
      return unless stripe_event.data.object.metadata.respond_to?(:consolidated_invoice)

      consolidated_payment = ConsolidatedPayment.find_by!(stripe_payout_id: stripe_event.data.object.id)
      ProcessPayoutForConsolidatedPaymentJob.perform_async(consolidated_payment.id)
    end
end
