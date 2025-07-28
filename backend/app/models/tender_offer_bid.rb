# frozen_string_literal: true

class TenderOfferBid < ApplicationRecord
  include ExternalId

  belongs_to :tender_offer
  belongs_to :company_investor

  validates :number_of_shares, presence: true, numericality: { greater_than: 0 }
  validates :accepted_shares, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :share_price_cents, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :share_class, presence: true
  validate :tender_offer_must_be_open, on: [:create]
  validate :share_price_must_be_valid, on: [:create]
  validate :single_stock_bids_must_not_exceed_total_amount, on: [:create]
  before_destroy do
    tender_offer_must_be_open
    throw(:abort) if errors.present?
  end
  validate :investor_must_have_adequate_securities, on: :create

  private
    def tender_offer_must_be_open
      return unless tender_offer
      return if tender_offer.open?

      errors.add(:base, "Tender offer is not open")
    end

    def investor_must_have_adequate_securities
      return if tender_offer.nil? || company_investor.nil?

      securities = tender_offer.securities_available_for_purchase(company_investor)
      info_for_security = securities.find { |security| security[:class_name] == share_class }
      max_count = info_for_security ? info_for_security[:count].to_f : 0.0
      if max_count < number_of_shares
        errors.add(:base, "Insufficient #{share_class} shares")
      end
    end

    def share_price_must_be_valid
      return if tender_offer.nil?

      if tender_offer.accepted_price_cents && share_price_cents != tender_offer.accepted_price_cents
        errors.add(:share_price_cents, "Must match the accepted share price")
      end

      if tender_offer.minimum_valuation
        return if tender_offer.company.fully_diluted_shares.zero?

        starting_price_cents = (tender_offer.minimum_valuation / tender_offer.company.fully_diluted_shares) * 100
        if share_price_cents < starting_price_cents
          formatted_price = Money.from_cents(starting_price_cents, :usd).format(symbol: true)
          errors.add(:share_price_cents, "Must be equal to or greater than #{formatted_price}")
        end
      end
    end

    def single_stock_bids_must_not_exceed_total_amount
      return unless tender_offer&.buyback_type == "single_stock"
      return if tender_offer.total_amount_in_cents.nil?
      return if number_of_shares.nil? || share_price_cents.nil?

      current_bid_amount = number_of_shares.to_d * share_price_cents.to_d

      existing_total = tender_offer.bids.sum("number_of_shares * share_price_cents")

      total_bid_amount = existing_total + current_bid_amount

      if total_bid_amount > tender_offer.total_amount_in_cents
        errors.add(:number_of_shares, "Total bid amount cannot exceed the tender offer's total amount")
      end
    end
end
