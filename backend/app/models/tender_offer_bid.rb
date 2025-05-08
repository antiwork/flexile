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
end
