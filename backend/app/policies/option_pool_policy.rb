# frozen_string_literal: true

class OptionPoolPolicy < ApplicationPolicy
  def create?
    company.equity_enabled? && company_administrator.present?
  end
end
