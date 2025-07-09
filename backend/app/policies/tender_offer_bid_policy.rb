# frozen_string_literal: true

class TenderOfferBidPolicy < ApplicationPolicy
  def index?
    company.tender_offers_enabled? && (company_administrator? || company_investor?)
  end

  def create?
    company.tender_offers_enabled? && company_investor?
  end

  def destroy?
    company.tender_offers_enabled? && company_investor? && record.company_investor == user.company_investor
  end
end
