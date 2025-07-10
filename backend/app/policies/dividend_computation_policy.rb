# frozen_string_literal: true

class DividendComputationPolicy < ApplicationPolicy
  def index?
    company_administrator.present?
  end

  def show?
    company_administrator.present?
  end

  def create?
    company_administrator.present?
  end

  def confirm?
    company_administrator.present?
  end

  def destroy?
    company_administrator.present?
  end
end