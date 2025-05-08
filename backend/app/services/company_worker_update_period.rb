# frozen_string_literal: true

class CompanyWorkerUpdatePeriod
  WEEK_START_DAY = :sunday
  DURATION = 1.week

  def initialize(date: Date.current)
    @date = date
  end

  def starts_on
    date.beginning_of_week(WEEK_START_DAY).to_date
  end

  def ends_on
    date.end_of_week(WEEK_START_DAY).to_date
  end

  def prev_period_starts_on
    prev_period.starts_on
  end

  def prev_period_ends_on
    prev_period.ends_on
  end

  def next_period_starts_on
    next_period.starts_on
  end

  def next_period_ends_on
    next_period.ends_on
  end

  # returns the number of weeks between the start of the current week
  # and the start of the period
  def relative_weeks
    ((starts_on - Date.today.beginning_of_week(WEEK_START_DAY)) / 7).to_i
  end

  def current_or_future_period?
    relative_weeks >= 0
  end

  def prev_period
    CompanyWorkerUpdatePeriod.new(date: date - DURATION)
  end

  def next_period
    CompanyWorkerUpdatePeriod.new(date: date + DURATION)
  end

  private
    attr_reader :date
end
