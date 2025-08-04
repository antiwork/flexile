# frozen_string_literal: true

class EquityGrantPolicy < ApplicationPolicy
  def index?
    return false unless company.equity_enabled?

    company_investor.present? || company_administrator.present? || company_lawyer.present?
  end

  def show?
    return false unless company.equity_enabled?

    return true if company_administrator.present? || company_lawyer.present?
    company_investor.present? && record.company_investor == company_investor
  end

  def create?
    company.equity_enabled? && company_administrator.present?
  end
end
