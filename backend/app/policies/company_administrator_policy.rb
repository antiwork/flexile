# frozen_string_literal: true

class CompanyAdministratorPolicy < ApplicationPolicy
  def show?
    company_administrator?
  end

  def reset?
    show?
  end

  def create?
    show?
  end

  def index?
    show?
  end

  def administrators?
    show?
  end

  def lawyers?
    show?
  end

  def add_role?
    show?
  end

  def remove_role?
    show?
  end
end
