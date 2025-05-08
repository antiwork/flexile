# frozen_string_literal: true

class CompanyInvestorPolicy < ApplicationPolicy
  def show?
    company_administrator.present? || company_lawyer.present?
  end
end
