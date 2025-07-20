# frozen_string_literal: true

class Settings::BankAccountPolicy < ApplicationPolicy
  def show?
    company_worker.present? || company_investor.present?
  end

  def index?
    show?
  end

  def create?
    show?
  end

  def update?
    show?
  end
end
