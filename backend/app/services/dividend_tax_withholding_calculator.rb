# frozen_string_literal: true

class DividendTaxWithholdingCalculator
  def initialize(company_investor, tax_year: Date.today.year, dividends:)
    @company_investor = company_investor
    @user = company_investor.user
    @tax_year = tax_year
    @dividends = dividends
  end

  def cents_to_withhold
    total_tax = 0.to_d
    dividends.each do |dividend|
      total_tax += ((withholding_percentage(dividend) * dividend.total_amount_in_cents.to_d) / 100.to_d)
    end
    (total_tax / 100).round * 100
  end

  def net_cents
    dividends.sum(&:total_amount_in_cents) - cents_to_withhold
  end

  def withholding_percentage(dividend)
    raise "The service wasn't initialised with this dividend record" if dividends.exclude?(dividend)

    return 0 if dividend.dividend_round.return_of_capital?

    dividends_in_tax_year = company_investor.dividends.joins(:dividend_round)
                                            .for_tax_year(tax_year)
                                            .where(dividend_rounds: { return_of_capital: false })
                                            .where.not(withholding_percentage: nil)
    return dividends_in_tax_year.maximum(:withholding_percentage) if dividends_in_tax_year.exists?

    TaxWithholdingCalculator.new(user).withholding_percentage
  end

  private
    attr_reader :user, :company_investor, :tax_year, :dividends
end
