# frozen_string_literal: true

class CompanyWorkerUpdatesForPeriodPolicy < ApplicationPolicy
  def index?
    return false unless company.team_updates_enabled?

    company_administrator.present? || (company_worker.present? && (company_worker.active? || company_worker.ended_at.future?))
  end

  def show?
    return false unless company.team_updates_enabled?

    company_worker.present? && (company_worker.active? || company_worker.ended_at.future?) &&
      record.company_worker.id === company_worker.id &&
      record.period.current_or_future_period?
  end

  def update?
    show?
  end
end
