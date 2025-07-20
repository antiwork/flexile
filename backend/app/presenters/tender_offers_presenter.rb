# frozen_string_literal: true

class TenderOffersPresenter
  def initialize(buybacks)
    @buybacks = buybacks
  end

  def props(user:, company:)
    buybacks = @buybacks.left_joins(:bids, :equity_buyback_rounds).includes(
      letter_of_transmittal_attachment: [:blob, { blob: :variant_records }],
      attachment_attachment: [:blob, { blob: :variant_records }]
    )

    if user.company_administrator_for?(company)
      buybacks = buybacks.select(
        "#{TenderOffer.table_name}.*",
        "COUNT(DISTINCT #{TenderOfferBid.table_name}.id) as bid_count",
        "COUNT(DISTINCT #{TenderOfferBid.table_name}.company_investor_id) as investor_count",
        "COUNT(DISTINCT #{EquityBuybackRound.table_name}.id) as equity_buyback_round_count",
        "SUM(COALESCE(#{TenderOfferBid.table_name}.accepted_shares, 0) * #{TenderOffer.table_name}.accepted_price_cents / 100.0) as participation"
      )
    else
      company_investor = user.company_investor_for(company)
      buybacks = buybacks.select(
        "#{TenderOffer.table_name}.*",
        ActiveRecord::Base.sanitize_sql_array([
                             "COUNT(DISTINCT CASE WHEN #{TenderOfferBid.table_name}.company_investor_id = ? THEN #{TenderOfferBid.table_name}.id END) as bid_count", company_investor.id]),
        "0 as investor_count",
        "COUNT(DISTINCT #{EquityBuybackRound.table_name}.id) as equity_buyback_round_count",
        ActiveRecord::Base.sanitize_sql_array(["SUM(COALESCE(CASE WHEN #{TenderOfferBid.table_name}.company_investor_id = ? THEN #{TenderOfferBid.table_name}.accepted_shares ELSE 0 END, 0) * #{TenderOffer.table_name}.accepted_price_cents / 100.0) as participation", company_investor.id])
      )
    end

    buybacks = buybacks.group("tender_offers.id")

    buybacks.map do |buyback|
      {
        id: buyback.external_id,
        name: buyback.name,
        buyback_type: buyback.buyback_type,
        starts_at: buyback.starts_at,
        ends_at: buyback.ends_at,
        minimum_valuation: buyback.minimum_valuation,
        total_amount_in_cents: buyback.total_amount_in_cents,
        accepted_price_cents: buyback.accepted_price_cents,
        open: buyback.open?,
        starting_price_per_share_cents: buyback.starting_price_per_share_cents,
        bid_count: buyback.bid_count,
        investor_count: buyback.investor_count,
        equity_buyback_round_count: buyback.equity_buyback_round_count,
        participation: buyback.participation,
        letter_of_transmittal: buyback.association(:letter_of_transmittal_attachment).loaded? && buyback.letter_of_transmittal&.attached? ? {
          key: buyback.letter_of_transmittal.key,
          filename: buyback.letter_of_transmittal.filename.to_s,
        } : nil,
        attachment: buyback.association(:attachment_attachment).loaded? && buyback.attachment&.attached? ? {
          key: buyback.attachment.key,
          filename: buyback.attachment.filename.to_s,
        } : nil,
      }
    end
  end
end
