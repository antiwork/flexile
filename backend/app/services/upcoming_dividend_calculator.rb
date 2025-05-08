# frozen_string_literal: true

class UpcomingDividendCalculator
  def initialize(company, amount_in_usd:)
    @company = company
    @amount_in_usd = amount_in_usd.to_d
  end

  def process
    service = DividendComputationGeneration.new(company, amount_in_usd:, return_of_capital: false)
    dividend_computation = service.process

    share_dividends, safe_dividends = dividend_computation.dividends_info

    share_dividends.each do |company_investor_id, info|
      CompanyInvestor.find(company_investor_id).update!(upcoming_dividend_cents: (info[:total_amount] * 100.to_d).to_i)
    end

    safe_dividends.each do |investor_name, info|
      company.convertible_investments
             .find_by(entity_name: investor_name)
             .update!(upcoming_dividend_cents: (info[:total_amount] * 100.to_d).to_i)
    end

    ensure
      dividend_computation.destroy!
  end

  private
    attr_reader :company, :amount_in_usd
end

=begin
company = Company.is_gumroad.sole
service = UpcomingDividendCalculator.new(company, amount_in_usd: 5_346_877)
service.process
=end
