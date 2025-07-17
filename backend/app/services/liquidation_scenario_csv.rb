# frozen_string_literal: true

class LiquidationScenarioCsv
  HEADERS = [
    "Investor Name",
    "Share Class", 
    "Security Type",
    "Number of Shares",
    "Payout Amount",
    "Liquidation Preference",
    "Participation Amount"
  ].freeze

  def initialize(liquidation_scenario)
    @liquidation_scenario = liquidation_scenario
    @payouts = liquidation_scenario.liquidation_payouts.includes(company_investor: :user)
  end

  def generate
    CSV.generate do |csv|
      csv << HEADERS
      
      @payouts.each do |payout|
        csv << [
          payout.company_investor.user&.email || "Unknown",
          payout.share_class,
          payout.security_type,
          payout.number_of_shares,
          format_currency(payout.payout_amount_cents),
          format_currency(payout.liquidation_preference_amount),
          format_currency(payout.participation_amount)
        ]
      end
      
      # Add totals row
      csv << []
      csv << ["Total", "", "", "", format_currency(@payouts.sum(:payout_amount_cents))]
    end
  end

  private

  def format_currency(cents)
    return "" if cents.nil?
    "$%.2f" % (cents / 100.0)
  end
end