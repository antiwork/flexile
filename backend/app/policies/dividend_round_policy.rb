# frozen_string_literal: true

class DividendRoundPolicy < ApplicationPolicy
  def create?
    return false unless company.equity_enabled?
    return false unless company_administrator.present?

    true
  end
end
