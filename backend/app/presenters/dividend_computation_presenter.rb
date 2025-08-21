# frozen_string_literal: true

class DividendComputationPresenter
  attr_reader :dividend_computation

  def initialize(dividend_computation)
    @dividend_computation = dividend_computation
  end

  def self.index_props(dividend_computations)
    dividend_computations.map do |dividend_computation|
      new(dividend_computation).details
    end
  end

  def props
    details.merge(
      computation_outputs: dividend_computation.broken_down_by_investor
    )
  end

  def details
    {
      id: dividend_computation.id,
      total_amount_in_usd: dividend_computation.total_amount_in_usd,
      dividends_issuance_date: dividend_computation.dividends_issuance_date,
      return_of_capital: dividend_computation.return_of_capital,
      number_of_shareholders: dividend_computation.number_of_shareholders,
    }
  end
end
