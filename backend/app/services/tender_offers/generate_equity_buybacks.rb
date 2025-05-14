# frozen_string_literal: true

class TenderOffers::GenerateEquityBuybacks
  def initialize(tender_offer:)
    @tender_offer = tender_offer
    @equilibrium_price_cents = tender_offer.accepted_price_cents
  end

  def perform
    ApplicationRecord.transaction do
      equity_buyback_round = create_equity_buyback_round
      create_equity_buybacks(equity_buyback_round)
    end
  end

  private
    attr_reader :tender_offer, :equilibrium_price_cents

    def create_equity_buyback_round
      EquityBuybackRound.create!(
        company: tender_offer.company,
        tender_offer:,
        number_of_shares: tender_offer.bids.sum(:accepted_shares),
        number_of_shareholders: tender_offer.bids.where("accepted_shares > 0").select(:company_investor_id).distinct.count,
        total_amount_cents: tender_offer.bids.sum("accepted_shares * #{equilibrium_price_cents}"),
        status: "Issued",
        issued_at: Time.current
      )
    end

    def create_equity_buybacks(equity_buyback_round)
      grouped_bids = tender_offer.bids.where("accepted_shares > 0").group_by { |bid| bid.company_investor_id }
      grouped_bids.each do |company_investor_id, tender_offer_bids|
        company_investor = CompanyInvestor.find(company_investor_id)

        tender_offer_bids.group_by { |bid| bid.share_class }.each do |share_class, bids|
          total_accepted_shares = bids.sum(&:accepted_shares)

          if share_class == TenderOffer::VESTED_SHARES_CLASS
            create_vested_shares_buybacks(equity_buyback_round, company_investor, total_accepted_shares, share_class)
          else
            create_shares_buybacks(equity_buyback_round, company_investor, total_accepted_shares, share_class)
          end
        end
      end

      equity_buyback_round.update!(total_amount_cents: equity_buyback_round.equity_buybacks.sum(:total_amount_cents))
    end

    def create_vested_shares_buybacks(equity_buyback_round, company_investor, total_accepted_shares, share_class)
      vested_grants = company_investor.equity_grants
                                      .where("vested_shares > 0")
                                      .order(exercise_price_usd: :asc, issued_at: :asc)

      remaining_shares = total_accepted_shares

      vested_grants.each do |grant|
        shares_from_grant = [remaining_shares, grant.vested_shares].min
        exercise_price_cents = (grant.exercise_price_usd * 100).to_i

        create_single_buyback(equity_buyback_round, company_investor, grant, share_class, shares_from_grant, exercise_price_cents)

        remaining_shares -= shares_from_grant
        break if remaining_shares.zero?
      end
    end

    def create_shares_buybacks(equity_buyback_round, company_investor, total_accepted_shares, share_class)
      share_holdings = company_investor.share_holdings
                                       .joins(:share_class)
                                       .where(share_class: { name: share_class })
                                       .order(originally_acquired_at: :asc, issued_at: :asc)

      remaining_shares = total_accepted_shares

      share_holdings.each do |share_holding|
        number_of_shares = [remaining_shares, share_holding.number_of_shares].min

        create_single_buyback(equity_buyback_round, company_investor, share_holding, share_class, number_of_shares, 0)

        remaining_shares -= number_of_shares
        break if remaining_shares.zero?
      end
    end

    def create_single_buyback(equity_buyback_round, company_investor, security, share_class, number_of_shares, exercise_price_cents)
      EquityBuyback.create!(
        company: tender_offer.company,
        equity_buyback_round:,
        company_investor:,
        security:,
        share_price_cents: equilibrium_price_cents,
        exercise_price_cents: exercise_price_cents,
        number_of_shares: number_of_shares,
        total_amount_cents: number_of_shares * (equilibrium_price_cents - exercise_price_cents),
        status: EquityBuyback::ISSUED,
        share_class: share_class
      )
    end
end

# tender_offer = TenderOffer.sole
# equilibrium_price_cents = TenderOffers::CalculateEquilibriumPrice.new(tender_offer:, total_amount_cents: 1_000_000_00).perform
# TenderOffers::GenerateEquityBuybacks.new(tender_offer:).perform
