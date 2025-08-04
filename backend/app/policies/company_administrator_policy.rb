# frozen_string_literal: true

class CompanyAdministratorPolicy < ApplicationPolicy
  def show?
    company_administrator?
  end

  def reset?
    show?
  end
end
