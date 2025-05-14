# frozen_string_literal: true

class VestStockOptionsJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(invoice_id)
    invoice = Invoice.find(invoice_id)
    return if invoice.equity_vested? || invoice.equity_amount_in_options <= 0

    user = invoice.user
    company_worker = user.company_workers.where(company_id: invoice.company_id).sole
    company_investor = user.company_investors.where(company_id: company_worker.company_id).sole

    equity_grant, undesired = company_investor.
      equity_grants.
      vesting_trigger_invoice_paid.
      where("unvested_shares >= ?", invoice.equity_amount_in_options).
      where("EXTRACT(YEAR FROM period_ended_at) = ?", invoice.invoice_date.year).
      first(2)

    if equity_grant.nil?
      raise "Not enough unvested shares available to vest #{invoice.equity_amount_in_options} shares for Invoice " \
        "#{invoice.id}"
    elsif undesired.present?
      raise "Error selecting option grant to vest #{invoice.equity_amount_in_options} shares for Invoice #{invoice.id}"
    end

    ActiveRecord::Base.transaction do
      EquityGrant::UpdateVestedShares.new(
        equity_grant:,
        invoice:,
        post_invoice_payment_vesting_event: equity_grant.vesting_events.create!(
          vesting_date: DateTime.current,
          vested_shares: invoice.equity_amount_in_options
        )
      ).process
      invoice.update!(equity_grant:)
    end
  end
end
