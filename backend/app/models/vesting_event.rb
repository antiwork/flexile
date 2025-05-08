# frozen_string_literal: true

class VestingEvent < ApplicationRecord
  include ExternalId

  CANCELLATION_REASONS = {
    not_enough_shares_available: "not_enough_shares_available",
  }.freeze

  has_paper_trail
  has_one :equity_grant_transaction
  belongs_to :equity_grant

  validates :vesting_date, presence: true
  validates :vested_shares, presence: true, numericality: { greater_than: 0 }
  validates :cancellation_reason, inclusion: { in: CANCELLATION_REASONS.values }, allow_nil: true, if: -> { cancelled_at.present? }

  scope :processed, -> { where.not(processed_at: nil) }
  scope :unprocessed, -> { where(processed_at: nil) }
  scope :cancelled, -> { where.not(cancelled_at: nil) }
  scope :not_cancelled, -> { where(cancelled_at: nil) }

  def mark_as_processed!
    update!(processed_at: Time.current)

    CompanyWorkerMailer.vesting_event_processed(id).deliver_later
  end

  def mark_cancelled!(reason: nil)
    return if cancelled_at.present?

    update!(cancelled_at: Time.current, cancellation_reason: reason)
  end
end
