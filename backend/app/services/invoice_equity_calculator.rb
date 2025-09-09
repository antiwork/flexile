# frozen_string_literal: true

class InvoiceEquityCalculator
  # If you make changes here, update the tRPC route equityCalculations in frontend/trpc/routes/equityCalculations.ts
  def initialize(company_worker:, company:, service_amount_cents:, invoice_year:)
    @company_worker = company_worker
    @company = company
    @service_amount_cents = service_amount_cents
    @invoice_year = invoice_year
  end

  def calculate
    unvested_grant = company_worker.unique_unvested_equity_grant_for_year(invoice_year)
    share_price_usd = unvested_grant&.share_price_usd || company.fmv_per_share_in_usd
    equity_percentage = company_worker.equity_percentage
    equity_amount_in_cents = ((service_amount_cents * equity_percentage) / 100.to_d).round
    equity_amount_in_options = company.equity_enabled? && share_price_usd.present? ? (equity_amount_in_cents / (share_price_usd * 100.to_d)).round : nil
    if equity_amount_in_options && equity_amount_in_options <= 0
      equity_percentage = 0
      equity_amount_in_cents = 0
    end

    {
      equity_cents: equity_amount_in_cents,
      equity_options: equity_amount_in_options,
      equity_percentage:,
    }
  end

  private
    attr_reader :company_worker, :company, :service_amount_cents, :invoice_year
end
