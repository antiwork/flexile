# frozen_string_literal: true

class CreateDividendRound
  attr_reader :dividend_computation

  def initialize(dividend_computation)
    @dividend_computation = dividend_computation
  end

  def process
    return { success: false, error: "Dividend computation is already finalized" } if @dividend_computation.finalized?

    ApplicationRecord.transaction do
      dividend_round = @dividend_computation.generate_dividends
      dividend_computation.mark_as_finalized!(dividend_round)

      { success: true, dividend_round: }
    end
  rescue ActiveRecord::RecordInvalid => e
    { success: false, error: e.record.errors.full_messages.to_sentence }
  rescue StandardError => e
    { success: false, error: e.message }
  end
end
