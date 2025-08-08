# frozen_string_literal: true

class CompanyPolicy < ApplicationPolicy
  def show?
    update?
  end

  def update?
    company_administrator.present? || record.nil?
  end

  def create?
    company_administrator.present?
  end
end
