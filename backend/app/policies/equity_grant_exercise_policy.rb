# frozen_string_literal: true

class EquityGrantExercisePolicy < ApplicationPolicy
  def create?
    return false unless company.json_flag?("option_exercising")

    company_investor.present? && company_worker.present?
  end

  def resend?
    return false unless company.json_flag?("option_exercising")

    company_investor.present? && company_worker.present? &&
      record.status == EquityGrantExercise::SIGNED
  end

  def process?
    return false unless company.json_flag?("option_exercising")

    company_administrator.present?
  end
end
