# frozen_string_literal: true

class ExpenseCategoryPolicy < ApplicationPolicy
  def index?
    company_administrator.present? || company_worker.present?
  end
end
