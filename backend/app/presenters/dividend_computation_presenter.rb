# frozen_string_literal: true

class DividendComputationPresenter
  attr_reader :dividend_computation

  def initialize(dividend_computation)
    @dividend_computation = dividend_computation
  end

  def index_props
    {
      id: dividend_computation.id,
      total_amount_in_usd: dividend_computation.total_amount_in_usd,
      dividends_issuance_date: dividend_computation.dividends_issuance_date,
      return_of_capital: dividend_computation.return_of_capital,
      number_of_shareholders: dividend_computation.number_of_shareholders,
    }
  end

  def props
    index_props.merge(
      computation_outputs: dividend_computation.broken_down_by_investor
    )
  end
end
