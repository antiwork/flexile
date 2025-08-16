# frozen_string_literal: true

class DividendComputationPresenter < BasePresenter
  def initialize(dividend_computation)
    super(dividend_computation)
    @dividend_computation = dividend_computation
  end

  def summary
    common_fields.merge(
      number_of_shareholders: @dividend_computation.dividend_computation_outputs.size
    )
  end

  def detailed_view
    common_fields.merge(
      computation_outputs: computation_outputs,
      totals: computation_totals,
    )
  end

  private
    def common_fields
      base_fields.merge(
        company_id: @dividend_computation.company.id,
        total_amount_in_usd: decimal_to_float(@dividend_computation.total_amount_in_usd),
        dividends_issuance_date: serialize_date(@dividend_computation.dividends_issuance_date),
        return_of_capital: @dividend_computation.return_of_capital
      )
    end

    def computation_outputs
      @dividend_computation.dividend_computation_outputs.includes(company_investor: :user).map do |output|
        {
          id: output.id,
          investor_name: output.investor_name || output.company_investor&.user&.name,
          share_class: output.share_class,
          number_of_shares: output.number_of_shares,
          hurdle_rate: decimal_to_float(output.hurdle_rate),
          original_issue_price_in_usd: decimal_to_float(output.original_issue_price_in_usd),
          preferred_dividend_amount_in_usd: decimal_to_float(output.preferred_dividend_amount_in_usd),
          dividend_amount_in_usd: decimal_to_float(output.dividend_amount_in_usd),
          qualified_dividend_amount_usd: decimal_to_float(output.qualified_dividend_amount_usd),
          total_amount_in_usd: decimal_to_float(output.total_amount_in_usd),
        }
      end
    end

    def computation_totals
      outputs = @dividend_computation.dividend_computation_outputs

      {
        total_shareholders: outputs.count,
        total_preferred_dividends: decimal_to_float(outputs.sum(:preferred_dividend_amount_in_usd)),
        total_common_dividends: decimal_to_float(outputs.sum(:dividend_amount_in_usd)),
        total_qualified_dividends: decimal_to_float(outputs.sum(:qualified_dividend_amount_usd)),
        grand_total: decimal_to_float(outputs.sum(:total_amount_in_usd)),
      }
    end
end
