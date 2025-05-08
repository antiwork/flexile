# frozen_string_literal: true

class VestingSchedule < ApplicationRecord
  include ExternalId

  has_paper_trail
  has_many :equity_grants

  validates :total_vesting_duration_months, presence: true, numericality: { greater_than: 0, less_than_or_equal_to: 120 }
  validates :vesting_frequency_months, inclusion: { in: [1, 3, 12] }
  validates :cliff_duration_months, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :total_vesting_duration_months, uniqueness: { scope: [:cliff_duration_months, :vesting_frequency_months] }
  validate :cliff_duration_not_exceeding_total_duration
  validate :vesting_frequency_months_not_exceeding_total_duration

  private
    def cliff_duration_not_exceeding_total_duration
      return if total_vesting_duration_months.nil? || cliff_duration_months.nil?

      if cliff_duration_months >= total_vesting_duration_months
        errors.add(:cliff_duration_months, "must be less than total vesting duration")
      end
    end

    def vesting_frequency_months_not_exceeding_total_duration
      return if total_vesting_duration_months.nil? || vesting_frequency_months.nil?

      if vesting_frequency_months > total_vesting_duration_months
        errors.add(:vesting_frequency_months, "must be less than total vesting duration")
      end
    end
end
