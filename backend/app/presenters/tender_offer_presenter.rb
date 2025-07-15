# frozen_string_literal: true

class TenderOfferPresenter
  delegate :external_id, :name, :starts_at, :ends_at, :minimum_valuation, :implied_valuation,
           :accepted_price_cents, :open?, :attachment, :letter_of_transmittal, to: :buyback

  def initialize(buyback)
    @buyback = buyback
  end

  def props(user:, company:)
    {
      id: external_id,
      name: name,
      starts_at: starts_at,
      ends_at: ends_at,
      minimum_valuation: minimum_valuation,
      # implied_valuation: implied_valuation,
      accepted_price_cents: accepted_price_cents,
      open: open?,
      bid_count: bid_count(user: user, company: company),
      investor_count: investor_count(user: user, company: company),
      participation: participation(user: user, company: company),
      attachment: attachment_data,
      letter_of_transmittal: letter_of_transmittal_data,
      equity_buyback_round_count: equity_buyback_round_count(),
    }
  end

  private
    attr_reader :buyback

    def investor_count(user: user, company: company)
      return nil unless user.company_administrator_for?(company)

      buyback.bids.select(:company_investor_id).distinct.count
    end

    def bid_count(user: user, company: company)
      if user.company_administrator_for?(company)
        buyback.bids.count
      elsif user.company_investor_for?(company)
        buyback.bids.where(company_investor: user.company_investor).count
      else
        0
      end
    end

    def equity_buyback_round_count
      buyback.equity_buyback_rounds.count
    end

    def participation(user: user, company: company)
      if user.company_administrator_for?(company)
        buyback.bids.sum { |bid| bid.accepted_shares.to_i * buyback.accepted_price_cents.to_i / 100 }
      elsif user.company_investor_for?(company)
        buyback.bids
          .where(company_investor: user.company_investor)
          .sum { |bid| bid.accepted_shares.to_i * buyback.accepted_price_cents.to_i / 100 }
      else
        0
      end
    end

    def attachment_data
      return nil unless attachment&.attached?

      {
        key: attachment.key,
        filename: attachment.filename.to_s,
      }
    end

    def letter_of_transmittal_data
      return nil unless letter_of_transmittal&.attached?

      {
        key: letter_of_transmittal.key,
        filename: letter_of_transmittal.filename.to_s,
      }
    end
end
