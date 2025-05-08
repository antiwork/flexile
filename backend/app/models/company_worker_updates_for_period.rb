# frozen_string_literal: true

class CompanyWorkerUpdatesForPeriod
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :company_worker
  attribute :period, default: -> { CompanyWorkerUpdatePeriod.new }

  validates :company_worker, :period, presence: true

  def current_update
    @current_update ||= company_worker.company_worker_updates.published.find_by(period_starts_on: period.starts_on, period_ends_on: period.ends_on)
  end

  def prev_update
    @prev_update ||= company_worker.company_worker_updates.published.find_by(period_starts_on: period.prev_period_starts_on, period_ends_on: period.prev_period_ends_on)
  end
end
