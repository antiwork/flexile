# frozen_string_literal: true

class TaxPolicy < ApplicationPolicy
  def show?
    company_worker.present? || company_investor.present?
  end

  def update?
    show?
  end
end
