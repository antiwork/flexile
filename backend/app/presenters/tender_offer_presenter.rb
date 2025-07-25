# frozen_string_literal: true

class TenderOfferPresenter
  def initialize(buyback)
    @buyback = buyback
  end

  def props(user:, company:)
    {
      id: buyback.external_id,
      name: buyback.name,
      buyback_type: buyback.buyback_type,
      starts_at: buyback.starts_at,
      ends_at: buyback.ends_at,
      minimum_valuation: buyback.minimum_valuation,
      total_amount_in_cents: buyback.total_amount_in_cents,
      implied_valuation: buyback.implied_valuation,
      accepted_price_cents: buyback.accepted_price_cents,
      open: buyback.open?,
      attachment: attachment_data,
      letter_of_transmittal: letter_of_transmittal_data,
      bid_count: bid_count(user: user, company: company),
      investor_count: investor_count(user: user, company: company),
      participation: participation(user: user, company: company).to_s,
      equity_buyback_round_count: equity_buyback_round_count(),
      equity_buyback_payment_count: equity_buyback_payment_count(),
    }
  end

  private
    attr_reader :buyback

    def investor_count(user:, company:)
      return nil unless user.company_administrator_for?(company)

      buyback.bids.select(:company_investor_id).distinct.count
    end

    def bid_count(user:, company:)
      if user.company_administrator_for?(company)
        buyback.bids.count
      elsif user.company_investor_for?(company)
        buyback.bids.where(company_investor: user.company_investor_for(company)).count
      else
        0
      end
    end

    def equity_buyback_round_count
      buyback.equity_buyback_rounds.count
    end

    def equity_buyback_payment_count
      buyback.equity_buyback_payments.count
    end

    def participation(user:, company:)
      return "0" if buyback.accepted_price_cents.nil?

      bids = if user.company_administrator_for?(company)
        buyback.bids
      elsif user.company_investor_for?(company)
        buyback.bids.where(company_investor: user.company_investor_for(company))
      else
        return "0"
      end

      bids.sum("COALESCE(accepted_shares, 0) * #{buyback.accepted_price_cents.to_d} / 100.0")
    end

    def attachment_data
      return nil unless buyback.attachment&.attached?

      {
        key: buyback.attachment.key,
        filename: buyback.attachment.filename.to_s,
      }
    end

    def letter_of_transmittal_data
      return nil unless buyback.letter_of_transmittal&.attached?

      {
        key: buyback.letter_of_transmittal.key,
        filename: buyback.letter_of_transmittal.filename.to_s,
      }
    end
end
