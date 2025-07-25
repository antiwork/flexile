# frozen_string_literal: true

class TenderOfferBidPolicy < ApplicationPolicy
  def index?
    company.tender_offers_enabled? && (company_administrator? || eligible_investor?)
  end

  def create?
    company.tender_offers_enabled? && eligible_investor?
  end

  def destroy?
    company.tender_offers_enabled? && company_investor? && record.company_investor == company_investor && eligible_investor?
  end

  private
    def tender_offer
      @tender_offer ||= record.is_a?(TenderOfferBid) ? record.tender_offer : record
    end

    def eligible_investor?
      company_investor? && tender_offer.tender_offer_investors.exists?(company_investor: company_investor)
    end
end
