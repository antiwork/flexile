# frozen_string_literal: true

class TaxPolicy < ApplicationPolicy
  def show?
    company_worker.present? || company_investor.present? || user.inviting_company?
  end

  def update?
    show?
  end
end
