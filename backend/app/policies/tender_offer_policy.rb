# frozen_string_literal: true

class TenderOfferPolicy < ApplicationPolicy
  def index?
    company.tender_offers_enabled? && (company_administrator? || company_investor?)
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
end
