# frozen_string_literal: true

class EquityGrantPolicy < ApplicationPolicy
  def index?
    company_investor.present? || company_administrator.present? || company_lawyer.present?
  end

  def show?
    return true if company_administrator.present? || company_lawyer.present?
    company_investor.present? && record.company_investor == company_investor
  end

  def create?
    company_administrator.present?
  end
end
