# frozen_string_literal: true

class DividendComputationGeneration
  DEFAULT_SHARE_HOLDING_DAYS = 60
  MAX_PREFERRED_SHARE_HOLDING_DAYS = 90
  private_constant :DEFAULT_SHARE_HOLDING_DAYS, :MAX_PREFERRED_SHARE_HOLDING_DAYS

  def initialize(company, amount_in_usd:, dividends_issuance_date: Date.current, return_of_capital:)
    @company = company
    @amount_in_usd = amount_in_usd.to_d
    @dividends_issuance_date = dividends_issuance_date
    @return_of_capital = return_of_capital
  end

  def process
    @computation = company.dividend_computations.create!(
      total_amount_in_usd: amount_in_usd, dividends_issuance_date:, return_of_capital:
    )
    @preferred_dividend_total = 0.to_d
    @common_dividend_total = 0.to_d

    generate_preferred_dividends
    generate_common_dividends

    computation
  end

  private
    attr_reader :company, :amount_in_usd, :dividends_issuance_date, :computation, :return_of_capital

    def generate_preferred_dividends
      shares_per_class_per_investor.each do |share_holding|
        hurdle_rate = share_holding.share_class.hurdle_rate
        original_issue_price_in_usd = share_holding.share_class.original_issue_price_in_dollars
        dividend_usd = qualified_dividend_amount_usd = 0
        if hurdle_rate.present?
          dividend_usd = roundup((hurdle_rate / 100.to_d) * original_issue_price_in_usd * share_holding.total_shares.to_d)
          qualified_dividend_amount_usd = roundup((hurdle_rate / 100.to_d) * original_issue_price_in_usd * share_holding.qualified_shares.to_d)
        end
        attrs = {
          company_investor_id: share_holding.company_investor_id,
          share_class: share_holding.share_class.name,
          number_of_shares: share_holding.total_shares,
          hurdle_rate:,
          original_issue_price_in_usd:,
          dividend_amount_in_usd: 0,
          preferred_dividend_amount_in_usd: dividend_usd,
          qualified_dividend_amount_usd:,
          total_amount_in_usd: dividend_usd,
        }
        computation.dividend_computation_outputs.create!(attrs)
        @preferred_dividend_total += dividend_usd
      end

      # I'm assuming that SAFEs don't have hurdle rates to keep things simple as that is also the current state
    end

    def generate_common_dividends
      available_amount = @amount_in_usd - @preferred_dividend_total

      eligible_fully_diluted_shares =
        company.convertible_investments.sum(:implied_shares) + company.share_holdings.sum(:number_of_shares)

      shares_per_class_per_investor.each do |share_holding|
        dividend_usd =
          roundup(available_amount * (share_holding.total_shares.to_d / eligible_fully_diluted_shares.to_d))
        qualified_dividend_amount_usd = roundup(available_amount * (share_holding.qualified_shares.to_d / eligible_fully_diluted_shares.to_d))
        attrs = {
          company_investor_id: share_holding.company_investor_id,
          share_class: share_holding.share_class.name,
          number_of_shares: share_holding.total_shares,
        }
        output = computation.dividend_computation_outputs.find_by(attrs)
        output.dividend_amount_in_usd = dividend_usd
        output.qualified_dividend_amount_usd += qualified_dividend_amount_usd
        output.total_amount_in_usd += dividend_usd
        output.save!
        @common_dividend_total += dividend_usd
      end

      company.convertible_investments.find_each do |convertible|
        dividend_usd = roundup(available_amount * (convertible.implied_shares.to_d / eligible_fully_diluted_shares.to_d))
        qualified_dividend_amount_usd = dividends_issuance_date - DEFAULT_SHARE_HOLDING_DAYS > convertible.issued_at ? dividend_usd : 0
        attrs = {
          investor_name: convertible.entity_name,
          share_class: convertible.identifier,
          number_of_shares: convertible.implied_shares,
          preferred_dividend_amount_in_usd: 0,
          dividend_amount_in_usd: dividend_usd,
          qualified_dividend_amount_usd:,
          total_amount_in_usd: dividend_usd,
        }
        computation.dividend_computation_outputs.create!(attrs)
        @common_dividend_total += dividend_usd
      end
    end

    # ROUNDUP(number, 2) in Excel
    def roundup(number)
      factor = (10**2).to_d
      (number * factor).ceil.to_d / factor
    end

    def shares_per_class_per_investor
      return @_shares_per_class_per_investor if defined?(@_shares_per_class_per_investor)

      @_shares_per_class_per_investor =
        company
          .share_holdings
          .joins(:share_class, :company_investor)
          .group(:company_investor_id, :share_class_id)
          .select(
            "company_investor_id, share_class_id, SUM(number_of_shares) AS total_shares, " \
              "SUM(" \
                "CASE WHEN (share_classes.preferred = TRUE) AND '#{dividends_issuance_date}'::date - #{MAX_PREFERRED_SHARE_HOLDING_DAYS} > share_holdings.originally_acquired_at THEN number_of_shares " \
                "WHEN (share_classes.preferred = FALSE) AND '#{dividends_issuance_date}'::date - #{DEFAULT_SHARE_HOLDING_DAYS} > share_holdings.originally_acquired_at THEN number_of_shares " \
                "ELSE 0 END"\
              ") AS qualified_shares"
          )
          .order(:company_investor_id)
          .load
    end
end

=begin
company = Company.is_gumroad.sole
service = DividendComputationGeneration.new(company, amount_in_usd: 5_346_877, return_of_capital: false)
service.process

puts service.instance_variable_get(:@preferred_dividend_total)
puts service.instance_variable_get(:@common_dividend_total)
puts service.instance_variable_get(:@preferred_dividend_total) + service.instance_variable_get(:@common_dividend_total)
=end
