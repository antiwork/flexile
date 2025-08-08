# frozen_string_literal: true

class DividendComputationPolicy < ApplicationPolicy
  def create?
    return false unless company.equity_enabled?

    company_administrator.present? || company_lawyer.present?
  end

  def investor_breakdown?
    return false unless company.equity_enabled?

    company_administrator.present? || company_lawyer.present?
  end
end
