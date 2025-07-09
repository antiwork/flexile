# frozen_string_literal: true

class DividendComputationPresenter
  def initialize(dividend_computation)
    @dividend_computation = dividend_computation
  end

  def props
    {
      id: @dividend_computation.id,
      total_amount_in_usd: @dividend_computation.total_amount_in_usd.to_f,
      dividends_issuance_date: @dividend_computation.dividends_issuance_date.to_s,
      return_of_capital: @dividend_computation.return_of_capital,
      created_at: @dividend_computation.created_at.to_s,
      confirmed_at: @dividend_computation.confirmed_at&.to_s,
      outputs: @dividend_computation.dividend_computation_outputs.map { |output| output_props(output) }
    }
  end

  private

  def output_props(output)
    {
      id: output.id,
      company_investor_id: output.company_investor_id,
      investor_name: output.investor_name || output.company_investor&.user&.legal_name,
      share_class: output.share_class,
      number_of_shares: output.number_of_shares,
      hurdle_rate: output.hurdle_rate,
      original_issue_price_in_usd: output.original_issue_price_in_usd&.to_f,
      preferred_dividend_amount_in_usd: output.preferred_dividend_amount_in_usd&.to_f,
      dividend_amount_in_usd: output.dividend_amount_in_usd&.to_f,
      qualified_dividend_amount_usd: output.qualified_dividend_amount_usd&.to_f,
      total_amount_in_usd: output.total_amount_in_usd&.to_f
    }
  end
end