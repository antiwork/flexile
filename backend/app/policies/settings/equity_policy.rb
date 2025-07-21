# frozen_string_literal: true

class Settings::EquityPolicy < ApplicationPolicy
  def update?
    company.equity_compensation_enabled?
  end
end
