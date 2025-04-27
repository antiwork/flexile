# frozen_string_literal: true

class EquityAllocationPolicy < ApplicationPolicy
  def show?
    return false unless company.equity_compensation_enabled?

    !company_worker&.salary? && authorized_to(:create?, Invoice)
  end

  def update?
    show? &&
      !record.locked? &&
      company_worker.unique_unvested_equity_grant_for_year(record.year).present?
  end
end
