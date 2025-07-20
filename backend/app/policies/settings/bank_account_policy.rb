# frozen_string_literal: true

class Settings::BankAccountPolicy < ApplicationPolicy
  def index?
    company_worker.present? || company_investor.present?
  end

  def create?
    index?
  end

  def update?
    index?
  end
end
