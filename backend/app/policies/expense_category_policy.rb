# frozen_string_literal: true

class ExpenseCategoryPolicy < ApplicationPolicy
  def index?
    company_administrator.present? || company_worker.present?
  end

  def update?
    company_administrator.present?
  end
end
