# frozen_string_literal: true

class OnboardingPolicy < ApplicationPolicy
  def show?
    company_worker.present? || company_investor.present?
  end

  def update?
    show?
  end

  def save_bank_account?
    show?
  end
end
