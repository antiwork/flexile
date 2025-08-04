# frozen_string_literal: true

module EquityGrant::Vesting
  extend ActiveSupport::Concern

  included do
    belongs_to :vesting_schedule, optional: true
    has_many :vesting_events, dependent: :destroy

    enum :vesting_trigger, {
      scheduled: "scheduled",
      invoice_paid: "invoice_paid",
    }, prefix: true, validate: true

    validates :period_started_at, presence: true
    validates :period_ended_at, presence: true
    validates :vesting_schedule, presence: true, if: :vesting_trigger_scheduled?
    validate :period_started_at_must_be_before_period_ended_at

    scope :period_not_ended, -> { where("DATE(period_ended_at) >= ?", Date.current) }
  end

  def build_vesting_events
    events = []
    return events unless vesting_trigger_scheduled?

    remaining_shares = number_of_shares
    total_vesting_events = vesting_schedule.total_vesting_duration_months / vesting_schedule.vesting_frequency_months
    shares_per_period = (remaining_shares / total_vesting_events).floor
    return events if shares_per_period == 0

    # Create all vesting events first
    total_vesting_events.times do |vesting_event_index|
      vesting_date = period_started_at + ((vesting_event_index + 1) * vesting_schedule.vesting_frequency_months).months
      vested_shares = vesting_event_index == total_vesting_events - 1 ? remaining_shares : shares_per_period

      events << {
        vesting_date: vesting_date,
        vested_shares: vested_shares,
      }
      remaining_shares -= vested_shares
    end

    # Handle cliff by combining events within cliff period
    if vesting_schedule.cliff_duration_months > 0
      cliff_date = period_started_at + vesting_schedule.cliff_duration_months.months
      events_in_cliff, events_after_cliff = events.partition { _1[:vesting_date] <= cliff_date }

      if events_in_cliff.any?
        total_cliff_shares = events_in_cliff.sum { _1[:vested_shares] }
        events = [{
          vesting_date: cliff_date,
          vested_shares: total_cliff_shares,
        }] + events_after_cliff
      end
    end

    events.map { vesting_events.build(_1) }
  end

  private
    def period_started_at_must_be_before_period_ended_at
      return if period_started_at.blank? || period_ended_at.blank?
      return if period_started_at < period_ended_at

      errors.add(:period_ended_at, "must be after the period start date")
    end
end
