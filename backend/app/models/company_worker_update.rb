# frozen_string_literal: true

class CompanyWorkerUpdate < ApplicationRecord
  include TimestampStateFields

  self.table_name = "company_contractor_updates"

  timestamp_state_fields :published, :deleted, default_state: :draft

  belongs_to :company_worker, foreign_key: :company_contractor_id
  belongs_to :company

  has_many :company_worker_update_tasks, foreign_key: :company_contractor_update_id, dependent: :destroy
  has_one :prev_update, ->(update) {
    if update.period_starts_on.nil?
      none
    else
      unscope(:where).where(
        company_worker: update.company_worker,
        period_starts_on: CompanyWorkerUpdatePeriod.new(date: update.period_starts_on).prev_period_starts_on
      )
    end
  }, class_name: "CompanyWorkerUpdate", foreign_key: nil
  has_many :absences, ->(record) { for_period(starts_on: record.period_starts_on, ends_on: record.period_ends_on) }, through: :company_worker, source: :company_worker_absences

  validates :period_starts_on, presence: true, uniqueness: { scope: [:company_contractor_id] }

  before_validation :set_company, on: :create

  private
    def set_company
      self.company ||= company_worker&.company
    end
end
