# frozen_string_literal: true

class DividendComputationPresenter
  attr_reader :company

  def initialize(company)
    @company = company
  end

  def props
    company.dividend_computations
      .with_shareholder_count
      .order(id: :desc)
      .map do |computation|
        {
          id: computation.id,
          total_amount_in_usd: computation.total_amount_in_usd,
          dividends_issuance_date: computation.dividends_issuance_date,
          return_of_capital: computation.return_of_capital,
          number_of_shareholders: computation.number_of_shareholders,
        }
      end
  end
end
