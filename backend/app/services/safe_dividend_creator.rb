# frozen_string_literal: true

class SafeDividendCreator
  def self.create_dividend!(company_investor:, dividend_round:, attributes: {})
    Dividend.find_or_create_for_investor_and_round!(
      company_investor:,
      dividend_round:,
      attributes:
    )
  end

  def self.create_dividends_for_round!(dividend_round:, investor_data:)
    created_dividends = []
    failed_creations = []

    investor_data.each do |data|
      company_investor = data[:company_investor] || CompanyInvestor.find(data[:company_investor_id])
      dividend = create_dividend!(
        company_investor:,
        dividend_round:,
        attributes: data[:attributes] || {}
      )
      created_dividends << dividend
    rescue => e
      failed_creations << { data:, error: e.message }
      Rails.logger.error "Failed to create dividend for investor #{data[:company_investor_id] || data[:company_investor]&.id}: #{e.message}"
    end

    {
      created: created_dividends,
      failed: failed_creations,
      success: failed_creations.empty?,
    }
  end
end
