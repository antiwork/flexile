# frozen_string_literal: true

class WiseTopUpReminderJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  REQUIRED_BUFFER = 50_000
  private_constant :REQUIRED_BUFFER

  SIMULATED_TOP_UP_AMOUNT = 500_000

  def perform
    company_ids = Company.active.is_trusted.pluck(:id)
    pending_invoice_amount_usd = Invoice.alive.where(status: [Invoice::RECEIVED, Invoice::APPROVED], company_id: company_ids).sum(&:cash_amount_in_usd)

    flexile_balance_usd = Wise::AccountBalance.refresh_flexile_balance
    return if flexile_balance_usd >= pending_invoice_amount_usd + REQUIRED_BUFFER

    message = +"Wise balance is #{ActiveSupport::NumberHelper.number_to_delimited(flexile_balance_usd)} USD. Pending invoice amount is #{ActiveSupport::NumberHelper.number_to_delimited(pending_invoice_amount_usd)} USD."
    if !Rails.env.production?
      result = Wise::AccountBalance.simulate_top_up_usd_balance(amount: SIMULATED_TOP_UP_AMOUNT)
      if result["state"] != "COMPLETED"
        message << " Automatic top-up failed: #{result["code"]} (#{result["message"]})"
      end
    end

    SlackMessageJob.perform_async(SlackChannel.flexile, "Top up Wise account", message, "red")
  end
end
