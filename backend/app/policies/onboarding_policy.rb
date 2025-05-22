# frozen_string_literal: true

class OnboardingPolicy < ApplicationPolicy
  def show?
    company_worker.present? || company_investor.present?
  end

  def update?
    show?
  end

  def legal?
    show?
  end

  def save_legal?
    show?
  end

  def bank_account?
    show?
  end

  def save_bank_account?
    show?
  end

  def contract?
    company_worker.present?
  end

  def save_contract?
    contract?
  end
end
