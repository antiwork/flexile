# frozen_string_literal: true

class DividendPresenter
  def initialize(dividend)
    @dividend = dividend
    @company_investor = dividend.company_investor
    @user = @company_investor.user
  end

  def props
    {
      total_amount_in_cents: @dividend.total_amount_in_cents,
      cumulative_return: @company_investor.cumulative_dividends_roi&.to_f,
      withheld_tax_cents: @dividend.withheld_tax_cents,
      bank_account_last_4: @user.bank_account_for_dividends&.last_four_digits,
      release_document: @dividend.dividend_round.release_document,
    }
  end
end
