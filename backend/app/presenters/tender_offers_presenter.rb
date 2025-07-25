# frozen_string_literal: true

class TenderOffersPresenter
  def initialize(buybacks)
    @buybacks = buybacks
  end

  def props(user:, company:)
    buybacks = @buybacks.left_joins(:equity_buyback_rounds, :equity_buyback_payments).includes(
      letter_of_transmittal_attachment: [:blob, { blob: :variant_records }],
      attachment_attachment: [:blob, { blob: :variant_records }]
    ).select(
      "#{TenderOffer.table_name}.*",
      "COUNT(DISTINCT #{EquityBuybackRound.table_name}.id) as equity_buyback_round_count",
      "COUNT(DISTINCT #{EquityBuybackPayment.table_name}.id) as equity_buyback_payment_count"
    ).group("tender_offers.id")

    if user.company_administrator_for?(company)
      bid_stats = @buybacks.joins(:bids).group("tender_offers.id").select(
        "tender_offers.id",
        "COUNT(#{TenderOfferBid.table_name}.id) as bid_count",
        "COUNT(DISTINCT #{TenderOfferBid.table_name}.company_investor_id) as investor_count",
        "CASE WHEN tender_offers.accepted_price_cents IS NOT NULL THEN SUM(COALESCE(#{TenderOfferBid.table_name}.accepted_shares, 0)) * tender_offers.accepted_price_cents / 100.0 ELSE 0 END as participation"
      )
    else
      company_investor = user.company_investor_for(company)
      bid_stats = @buybacks.joins(:bids).where(tender_offer_bids: { company_investor_id: company_investor.id }).group("tender_offers.id").select(
        "tender_offers.id",
        "COUNT(#{TenderOfferBid.table_name}.id) as bid_count",
        "0 as investor_count",
        "CASE WHEN tender_offers.accepted_price_cents IS NOT NULL THEN SUM(COALESCE(#{TenderOfferBid.table_name}.accepted_shares, 0)) * tender_offers.accepted_price_cents / 100.0 ELSE 0 END as participation"
      )
    end

    bid_stats_hash = bid_stats.index_by(&:id)

    buybacks.map do |buyback|
      bid_data = bid_stats_hash[buyback.id]

      {
        id: buyback.external_id,
        name: buyback.name,
        buyback_type: buyback.buyback_type,
        starts_at: buyback.starts_at,
        ends_at: buyback.ends_at,
        minimum_valuation: buyback.minimum_valuation,
        implied_valuation: buyback.implied_valuation,
        total_amount_in_cents: buyback.total_amount_in_cents,
        accepted_price_cents: buyback.accepted_price_cents,
        open: buyback.open?,
        bid_count: bid_data&.bid_count.to_i || 0,
        investor_count: bid_data&.investor_count.to_i || 0,
        equity_buyback_round_count: buyback.equity_buyback_round_count.to_i,
        equity_buyback_payment_count: buyback.equity_buyback_payment_count.to_i,
        participation: bid_data&.participation || "0",
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
