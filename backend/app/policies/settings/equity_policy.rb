# frozen_string_literal: true

class Settings::EquityPolicy < ApplicationPolicy
  def update?
    company.equity_enabled?
  end
end
