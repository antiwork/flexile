# frozen_string_literal: true

class CompanyAdministratorPolicy < ApplicationPolicy
  def show?
    user.company_administrator_for?(company)
  end

  def reset?
    show?
  end

  def create?
    company_administrator.present?
  end
end
