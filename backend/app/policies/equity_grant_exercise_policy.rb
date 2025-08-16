# frozen_string_literal: true

class EquityGrantExercisePolicy < ApplicationPolicy
  def create?
    company_investor.present? && company_worker.present?
  end

  def resend?
    company_investor.present? && company_worker.present? &&
      record.status == EquityGrantExercise::SIGNED
  end

  def process?
    company_administrator.present?
  end
end
