# frozen_string_literal: true

class DividendComputationPolicy < ApplicationPolicy
  def create?
    return unless company.equity_enabled?

    company_administrator.present? || company_lawyer.present?
  end

  def per_investor?
    return unless company.equity_enabled?

    company_administrator.present? || company_lawyer.present?
  end
end
