# frozen_string_literal: true

class DividendRoundPresenter
  def initialize(dividend_round)
    @dividend_round = dividend_round
  end

  def props
    {
      id: dividend_round.id,
      external_id: dividend_round.external_id,
      issued_at: dividend_round.issued_at,
      total_amount_in_cents: dividend_round.total_amount_in_cents,
      number_of_shareholders: dividend_round.number_of_shareholders,
      number_of_shares: dividend_round.number_of_shares,
      status: dividend_round.status,
      return_of_capital: dividend_round.return_of_capital,
      ready_for_payment: dividend_round.ready_for_payment,
      dividends_count: dividend_round.dividends.count,
      finalized: dividend_round.dividends.exists?,
    }
  end

  private
    attr_reader :dividend_round
end
