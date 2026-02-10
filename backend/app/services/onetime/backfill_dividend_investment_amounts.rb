# frozen_string_literal: true

class Onetime::BackfillDividendInvestmentAmounts
  def perform
    backfill_share_based_dividends
    backfill_convertible_based_dividends
    backfill_remaining_dividends
  end

  private
    # For share-based dividends (number_of_shares IS NOT NULL),
    # use the company_investor's investment_amount_in_cents
    def backfill_share_based_dividends
      Dividend.where(investment_amount_cents: nil)
              .where.not(number_of_shares: nil)
              .find_each do |dividend|
        dividend.update_columns(
          investment_amount_cents: dividend.company_investor.investment_amount_in_cents
        )
      end
    end

    # For convertible/SAFE-based dividends (number_of_shares IS NULL),
    # use the sum of convertible_securities.principal_value_in_cents for that investor
    def backfill_convertible_based_dividends
      Dividend.where(investment_amount_cents: nil, number_of_shares: nil)
              .find_each do |dividend|
        principal = dividend.company_investor
                            .convertible_securities
                            .sum(:principal_value_in_cents)
        dividend.update_columns(investment_amount_cents: principal)
      end
    end

    # Fallback: set any remaining NULL values to 0
    def backfill_remaining_dividends
      Dividend.where(investment_amount_cents: nil)
              .update_all(investment_amount_cents: 0)
    end
end
