# frozen_string_literal: true

class CompanyInvestorEntityPolicy < ApplicationPolicy
  def show?
    return false unless company.equity_enabled?
    company_administrator.present? || company_lawyer.present?
  end
end
