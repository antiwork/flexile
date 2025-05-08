# frozen_string_literal: true

class CompanyWorkerAbsence < ApplicationRecord
  self.table_name = "company_contractor_absences"

  belongs_to :company_worker, foreign_key: :company_contractor_id
  belongs_to :company

  validates :company_worker, :starts_on, :ends_on, presence: true
  validate :starts_on_not_after_ends_on
  validate :no_overlapping_periods

  before_validation :set_company, on: :create

  scope :for_period, ->(starts_on:, ends_on:) {
    where(CompanyWorkerAbsence.arel_table.name => { starts_on: ..ends_on, ends_on: starts_on.. })
  }

  scope :for_current_period, -> {
    period = CompanyWorkerUpdatePeriod.new
    for_period(starts_on: period.starts_on, ends_on: period.ends_on)
  }

  scope :for_current_and_future_periods, -> {
    where("ends_on >= :date", date: CompanyWorkerUpdatePeriod.new.starts_on)
  }

  scope :for_current_and_future_periods, -> {
    where("ends_on >= :date", date: CompanyWorkerUpdatePeriod.new.starts_on)
  }

  private
    def set_company
      self.company ||= company_worker&.company
    end

    def starts_on_not_after_ends_on
      return if starts_on.blank? || ends_on.blank?
      errors.add(:starts_on, "must be less than or equal to the end date") if starts_on.after?(ends_on)
    end

    def no_overlapping_periods
      return if company_worker.blank?
      overlapping = company_worker.company_worker_absences
        .where.not(id:)
        .for_period(starts_on:, ends_on:)
        .exists?

      errors.add(:base, "Overlaps with an existing absence") if overlapping
    end
end
