# frozen_string_literal: true

class CompanyUpdatePolicy < ApplicationPolicy
  def index?
    company_administrator.present? || company_worker.present? || company_investor.present?
  end

  def show?
    if record.status == CompanyUpdate::DRAFT
      company_administrator.present?
    else
      company_administrator.present? || company_worker.present? || company_investor.present?
    end
  end

  def new?
    company_administrator.present?
  end

  def create?
    new?
  end

  def edit?
    create?
  end

  def update?
    edit?
  end

  def destroy?
    edit?
  end

  def send_test_email?
    company_administrator.present?
  end
end
