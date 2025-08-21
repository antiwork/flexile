# frozen_string_literal: true

class EquityGrantExercisePolicy < ApplicationPolicy
  def new?
    return false unless company.option_exercising_enabled?

    (company_investor.present? && company_worker.present?) || company_administrator?
  end

  def create?
    return false unless company.option_exercising_enabled?

    company_investor.present? && company_worker.present?
  end

  def resend?
    return false unless company.option_exercising_enabled?

    company_investor.present? && company_worker.present? &&
      record.status == EquityGrantExercise::SIGNED
  end

  def process?
    return false unless company.option_exercising_enabled?

    company_administrator.present?
  end
end
