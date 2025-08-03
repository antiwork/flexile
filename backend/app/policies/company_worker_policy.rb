# frozen_string_literal: true

class CompanyWorkerPolicy < ApplicationPolicy
  def index?
    company_administrator.present?
  end

  def new?
    company_administrator.present?
  end

  def create?
    company_administrator.present?
  end

  def show?
    company_administrator.present?
  end

  def update?
    company_administrator.present? || company_worker.present? && company_worker.user == user
  end

  def updates?
    company_administrator.present?
  end
end
