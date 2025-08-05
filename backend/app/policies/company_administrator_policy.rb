# frozen_string_literal: true

class CompanyAdministratorPolicy < ApplicationPolicy
  def show?
    user.company_administrator_for?(company)
  end

  def reset?
    show?
  end

  def create?
    user.company_administrator_for?(company)
  end
end
