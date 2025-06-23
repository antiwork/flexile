# frozen_string_literal: true

class InvestorDividendsPaymentJob
  include Sidekiq::Job
  sidekiq_options retry: 0

  delegate :user, to: :company_investor, private: true
  delegate :tax_information_confirmed_at, :compliance_info, to: :user, private: :true

  def perform(company_investor_id)
    @company_investor = CompanyInvestor.find(company_investor_id)

    return if !user.has_verified_tax_id? || tax_information_confirmed_at.nil?

    update_dividend_tax_info

    dividends_eligible_for_payment = company_investor
                                       .dividends
                                       .joins(:dividend_round)
                                       .where(status: [Dividend::ISSUED, Dividend::RETAINED])
                                       .where("dividends.signed_release_at IS NOT NULL OR dividend_rounds.release_document IS NULL")
    PayInvestorDividends.new(company_investor, dividends_eligible_for_payment).process
  end

  private
    attr_reader :company_investor

    def update_dividend_tax_info
      company_investor.dividends.each do |dividend|
        next if dividend.values_at(:net_amount_in_cents, :withheld_tax_cents, :withholding_percentage).all?(&:present?)

        tax_withholding_calculator = DividendTaxWithholdingCalculator.new(company_investor,
                                                                          tax_year: dividend.created_at.year,
                                                                          dividends: [dividend])
        dividend.update!(
          net_amount_in_cents: tax_withholding_calculator.net_cents,
          withheld_tax_cents: tax_withholding_calculator.cents_to_withhold,
          withholding_percentage: tax_withholding_calculator.withholding_percentage(dividend),
          user_compliance_info_id: compliance_info.id,
        )
      end
    end
end
