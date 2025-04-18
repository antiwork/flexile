# frozen_string_literal: true

class InvoiceEquityCalculator
  # If you make changes here, update the tRPC route equityCalculations in apps/next/trpc/routes/equityCalculations.ts
  def initialize(company_worker:, company:, service_amount_cents:, invoice_year:)
    @company_worker = company_worker
    @company = company
    @service_amount_cents = service_amount_cents
    @invoice_year = invoice_year
  end

  def calculate
    is_equity_allocation_locked = nil
    selected_percentage = nil
    equity_percentage = if company.equity_compensation_enabled?
      equity_allocation = company_worker.equity_allocation_for(invoice_year)
      is_equity_allocation_locked = equity_allocation&.locked?
      if equity_allocation&.equity_percentage
        selected_percentage = equity_allocation&.equity_percentage
      else
        0
      end
    else
      0
    end
    unvested_grant = company_worker.unique_unvested_equity_grant_for_year(invoice_year)
    share_price_usd = unvested_grant&.share_price_usd || company.fmv_per_share_in_usd
    if equity_percentage.nonzero? && share_price_usd.nil?
      Bugsnag.notify("InvoiceEquityCalculator: Error determining share price for CompanyWorker #{company_worker.id}")
      return
    end
    equity_amount_in_cents = ((service_amount_cents * equity_percentage) / 100.to_d).round
    equity_amount_in_options =
      if equity_percentage.zero?
        0
      else
        (equity_amount_in_cents / (share_price_usd * 100.to_d)).round
      end
    if equity_amount_in_options <= 0
      equity_percentage = 0
      equity_amount_in_cents = 0
      equity_amount_in_options = 0
    end

    {
      equity_cents: equity_amount_in_cents,
      equity_options: equity_amount_in_options,
      selected_percentage:, # null | number - the equity % selected by the company_worker
      equity_percentage:, # number - the equity % used for this computation
      is_equity_allocation_locked:,
    }
  end

  private
    attr_reader :company_worker, :company, :service_amount_cents, :invoice_year
end
