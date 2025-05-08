# frozen_string_literal: true

class CompanyPolicy < ApplicationPolicy
  def show?
    update?
  end

  def update?
    company_administrator.present? || user.initial_onboarding?
  end
end
