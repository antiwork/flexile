# frozen_string_literal: true

class DividendComputationPresenter
  def initialize(dividend_computation, include_outputs: false)
    @dividend_computation = dividend_computation
    @include_outputs = include_outputs
  end

  def props
    base_props = {
      id: @dividend_computation.external_id,
      name: @dividend_computation.name,
      total_amount_in_usd: @dividend_computation.total_amount_in_usd,
      dividends_issuance_date: @dividend_computation.dividends_issuance_date,
      return_of_capital: @dividend_computation.return_of_capital,
      created_at: @dividend_computation.created_at,
      outputs_count: @dividend_computation.dividend_computation_outputs.size,
      shareholder_count: shareholder_count,
      finalized: finalized?,
      release_document: @dividend_computation.release_document,
    }

    if @include_outputs
      base_props[:outputs] = outputs
    end

    base_props
  end

  private
    def shareholder_count
      outputs = @dividend_computation.dividend_computation_outputs
      company_investor_count = outputs.filter_map(&:company_investor_id).uniq.count
      investor_name_count = outputs.filter_map(&:investor_name).uniq.count
      company_investor_count + investor_name_count
    end

    def finalized?
      @dividend_computation.company.dividend_rounds.joins(:dividends).where(
        issued_at: @dividend_computation.dividends_issuance_date,
        total_amount_in_cents: (@dividend_computation.total_amount_in_usd * 100).round
      ).exists?
    end

    def outputs
      @dividend_computation.dividend_computation_outputs.map do |output|
        investor_name = output.investor_name || output.company_investor&.user&.legal_name
        fee_in_usd = Dividend.new(total_amount_in_cents: (output.total_amount_in_usd * 100).round).calculate_flexile_fee_cents / 100.0

        {
          investor_name: investor_name,
          share_class: output.share_class,
          number_of_shares: output.number_of_shares,
          hurdle_rate: output.hurdle_rate,
          original_issue_price_in_usd: output.original_issue_price_in_usd,
          dividend_amount_in_usd: output.dividend_amount_in_usd,
          preferred_dividend_amount_in_usd: output.preferred_dividend_amount_in_usd,
          qualified_dividend_amount_usd: output.qualified_dividend_amount_usd,
          total_amount_in_usd: output.total_amount_in_usd,
          fee_in_usd: fee_in_usd,
        }
      end
    end
end
