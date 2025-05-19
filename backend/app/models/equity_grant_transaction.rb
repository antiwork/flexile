# frozen_string_literal: true

class EquityGrantTransaction < ApplicationRecord
  include ExternalId

  has_paper_trail

  belongs_to :equity_grant
  belongs_to :vesting_event, optional: true
  belongs_to :invoice, optional: true
  belongs_to :equity_grant_exercise, optional: true

  enum :transaction_type, {
    scheduled_vesting: "scheduled_vesting",
    vesting_post_invoice_payment: "vesting_post_invoice_payment",
    exercise: "exercise",
    cancellation: "cancellation",
    manual_adjustment: "manual_adjustment",
    end_of_period_forfeiture: "end_of_period_forfeiture",
  }, prefix: true, validate: true

  validates :equity_grant_id, uniqueness: { scope: [:transaction_type, :vesting_event_id, :invoice_id, :equity_grant_exercise_id] }
  validates :vested_shares, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :exercised_shares, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :forfeited_shares, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :total_number_of_shares, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
  validates :total_vested_shares, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :total_unvested_shares, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :total_exercised_shares, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :total_forfeited_shares, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  validate :validate_associated_records

  private
    def validate_associated_records
      case transaction_type
      when "scheduled_vesting", "vesting_post_invoice_payment"
        errors.add(:vesting_event, "must be present for vesting transactions") unless vesting_event
      when "vesting_post_invoice_payment"
        errors.add(:invoice, "must be present for post-invoice payment vesting") unless invoice
      when "exercise"
        errors.add(:equity_grant_exercise, "must be present for exercise transactions") unless equity_grant_exercise
      end
    end
end
