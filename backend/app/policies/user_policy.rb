# frozen_string_literal: true

class UserPolicy < ApplicationPolicy
  def show?
    true
  end

  def update?
    company_worker.present? || company_investor.present? || company_lawyer.present? || company_administrator.present?
  end
end
