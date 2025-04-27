# frozen_string_literal: true

class FinancingRoundPolicy < ApplicationPolicy
  def index?
    return false unless company.financing_rounds_enabled?

    company_administrator.present? || company_lawyer.present? || company_investor.present?
  end
end
