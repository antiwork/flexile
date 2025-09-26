# frozen_string_literal: true

class CompanyUpdatePolicy < ApplicationPolicy
  def index?
    return false unless company.company_investors.active.exists?
    company_administrator.present? ||
      company_worker.present? ||
      (company_investor.present? && !company_investor.deactivated_at?)
  end

  def show?
    return false unless company.company_investors.active.exists?
    if record.status == CompanyUpdate::DRAFT
      company_administrator.present?
    else
      company_administrator.present? ||
        company_worker.present? ||
        (company_investor.present? && !company_investor.deactivated_at?)
    end
  end

  def new?
    company.company_investors.active.exists? && company_administrator.present?
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
    company.company_investors.active.exists? && company_administrator.present?
  end
end
