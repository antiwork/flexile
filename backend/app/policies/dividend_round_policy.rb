# frozen_string_literal: true

class DividendRoundPolicy < ApplicationPolicy
  def index?
    return unless company.equity_enabled?

    company_administrator.present? || company_lawyer.present?
  end

  def create?
    return false unless company.equity_enabled?

    company_administrator.present?
  end
end
