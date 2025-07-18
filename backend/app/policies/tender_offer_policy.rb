# frozen_string_literal: true

class TenderOfferPolicy < ApplicationPolicy
  def index?
    company.tender_offers_enabled? && (company_administrator? || eligible_investor?)
  end

  def show?
    index?
  end

  def create?
    company.tender_offers_enabled? && company_administrator?
  end

  def finalize?
    company.tender_offers_enabled? && company_administrator?
  end

  private
    def eligible_investor?
      company_investor? && record.tender_offer_investors.exists?(company_investor: company_investor)
    end
end
