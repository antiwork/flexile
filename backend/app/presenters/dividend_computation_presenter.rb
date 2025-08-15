# frozen_string_literal: true

class DividendComputationPresenter
  def initialize(dividend_computation)
    @dividend_computation = dividend_computation
  end

  def summary
    {
      id: @dividend_computation.id,
      total_amount_in_usd: @dividend_computation.total_amount_in_usd.to_f,
      dividends_issuance_date: @dividend_computation.dividends_issuance_date.iso8601,
      return_of_capital: @dividend_computation.return_of_capital,
      created_at: @dividend_computation.created_at.iso8601,
      updated_at: @dividend_computation.updated_at.iso8601,
      number_of_outputs: @dividend_computation.dividend_computation_outputs.count
    }
  end

  def detailed_view
    {
      id: @dividend_computation.id,
      total_amount_in_usd: @dividend_computation.total_amount_in_usd.to_f,
      dividends_issuance_date: @dividend_computation.dividends_issuance_date.iso8601,
      return_of_capital: @dividend_computation.return_of_capital,
      created_at: @dividend_computation.created_at.iso8601,
      updated_at: @dividend_computation.updated_at.iso8601,
      computation_outputs: computation_outputs,
      totals: computation_totals
    }
  end

  private

    def computation_outputs
      @dividend_computation.dividend_computation_outputs.includes(:company_investor).map do |output|
        {
          id: output.id,
          investor_name: output.investor_name || output.company_investor&.user&.name,
          share_class: output.share_class,
          number_of_shares: output.number_of_shares,
          hurdle_rate: output.hurdle_rate&.to_f,
          original_issue_price_in_usd: output.original_issue_price_in_usd&.to_f,
          preferred_dividend_amount_in_usd: output.preferred_dividend_amount_in_usd.to_f,
          dividend_amount_in_usd: output.dividend_amount_in_usd.to_f,
          qualified_dividend_amount_usd: output.qualified_dividend_amount_usd.to_f,
          total_amount_in_usd: output.total_amount_in_usd.to_f
        }
      end
    end

    def computation_totals
      outputs = @dividend_computation.dividend_computation_outputs
      
      {
        total_shareholders: outputs.count,
        total_preferred_dividends: outputs.sum(:preferred_dividend_amount_in_usd).to_f,
        total_common_dividends: outputs.sum(:dividend_amount_in_usd).to_f,
        total_qualified_dividends: outputs.sum(:qualified_dividend_amount_usd).to_f,
        grand_total: outputs.sum(:total_amount_in_usd).to_f
      }
    end
end