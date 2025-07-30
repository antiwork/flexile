# frozen_string_literal: true

class BankAccountPolicy < ApplicationPolicy
  def index?
    company_worker.present? || company_investor.present?
  end

  def create?
    show?
  end

  def update?
    show?
  end
end
