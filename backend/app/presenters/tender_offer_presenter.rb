# frozen_string_literal: true

class TenderOfferPresenter
  delegate :external_id, :name, :starts_at, :ends_at, :minimum_valuation, :total_amount_in_cents, :implied_valuation, :buyback_type,
           :accepted_price_cents, :open?, :attachment, :letter_of_transmittal, :starting_price_per_share_cents, to: :buyback

  def initialize(buyback)
    @buyback = buyback
  end

  def props(user:, company:)
    {
      id: external_id,
      name: name,
      buyback_type: buyback_type,
      starts_at: starts_at,
      ends_at: ends_at,
      minimum_valuation: minimum_valuation,
      total_amount_in_cents: total_amount_in_cents,
      # implied_valuation: implied_valuation,
      accepted_price_cents: accepted_price_cents,
      open: open?,
      bid_count: bid_count(user: user, company: company),
      investor_count: investor_count(user: user, company: company),
      participation: participation(user: user, company: company),
      attachment: attachment_data,
      letter_of_transmittal: letter_of_transmittal_data,
      equity_buyback_round_count: equity_buyback_round_count(),
      equity_buyback_payments_count: equity_buyback_payments_count(),
      starting_price_per_share_cents: starting_price_per_share_cents,
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
        buyback.bids.where(company_investor: user.company_investor_for(company)).count
      else
        0
      end
    end

    def equity_buyback_round_count
      buyback.equity_buyback_rounds.count
    end

    def equity_buyback_payments_count
      buyback.equity_buyback_payments.count
    end

    def participation(user: user, company: company)
      return 0 if buyback.accepted_price_cents.nil?
      if user.company_administrator_for?(company)
        buyback.bids.sum("COALESCE(accepted_shares, 0) * #{buyback.accepted_price_cents} / 100.0")
      elsif user.company_investor_for?(company)
        buyback.bids.where(company_investor: user.company_investor_for(company)).sum("COALESCE(accepted_shares, 0) * #{buyback.accepted_price_cents} / 100.0")
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
