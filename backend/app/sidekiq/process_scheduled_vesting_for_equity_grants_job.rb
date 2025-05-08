# frozen_string_literal: true

class ProcessScheduledVestingForEquityGrantsJob
  include Sidekiq::Job

  def perform
    EquityGrant
      .vesting_trigger_scheduled
      .period_not_ended
      .accepted
      .find_each do
      ProcessEquityGrantScheduledVestingJob.perform_async(_1.id)
    end
  end
end
