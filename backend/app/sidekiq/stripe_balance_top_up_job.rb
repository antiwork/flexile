# frozen_string_literal: true

class StripeBalanceTopUpJob
  include Sidekiq::Job
  sidekiq_options retry: 1, queue: :default, lock: :until_executed

  TOPUP_TARGET = 500_000 # $5,000 in cents
  USD_CURRENCY = "USD"

  def perform
    create_payment_intent if topup_needed?
    notify_slack
  end

  private
    def topup_needed?
      topup_amount.positive?
    end

    def topup_amount
      @_topup_amount ||= [TOPUP_TARGET - (available_balance + pending_balance), 0].max
    end

    def available_balance
      @_available_balance ||= stripe_balance.available.first&.amount || 0
    end

    def pending_balance
      @_pending_balance ||= stripe_balance.pending.first&.amount || 0
    end

    def stripe_balance
      @_stripe_balance ||= Stripe::Balance.retrieve.tap do |balance|
        balance.available.select! { |b| b.currency.casecmp?(USD_CURRENCY) }
        balance.pending.select! { |b| b.currency.casecmp?(USD_CURRENCY) }
      end
    end

    def create_payment_intent
      company = Company.is_gumroad.sole
      stripe_setup_intent = company.fetch_stripe_setup_intent
      Stripe::PaymentIntent.create(
        {
          payment_method_types: ["us_bank_account"],
          payment_method: stripe_setup_intent.payment_method,
          customer: stripe_setup_intent.customer,
          confirm: true,
          amount: topup_amount,
          currency: USD_CURRENCY,
          description: "Weekly balance top-up",
        }
      )
    end

    def notify_slack
      SlackMessageJob.perform_async(SlackChannel.flexile, "Stripe Top-up", slack_message)
    end

    def slack_message
      <<~MESSAGE
      #{topup_needed? ? "Stripe balance topped up" : "No Stripe top-up needed"}
      Available balance: $#{available_balance / 100.0}
      Pending balance: $#{pending_balance / 100.0}
      Top-up amount: $#{topup_amount / 100.0}
      Stripe dashboard: https://dashboard.stripe.com/balance
      MESSAGE
    end
end
