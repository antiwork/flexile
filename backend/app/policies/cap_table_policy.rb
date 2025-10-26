# frozen_string_literal: true

class CapTablePolicy < ApplicationPolicy
  def create?
    return false unless company_administrator?
    company.cap_table_empty?
  end

  def show?
    return false unless company.equity_enabled?

    company_administrator.present? ||
      company_lawyer.present? ||
      (company_investor.present? && !company_investor.deactivated_at?)
  end

  def export?
    show?
  end
end
