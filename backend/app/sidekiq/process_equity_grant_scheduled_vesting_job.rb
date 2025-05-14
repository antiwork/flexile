# frozen_string_literal: true

class ProcessEquityGrantScheduledVestingJob
  include Sidekiq::Job

  def perform(equity_grant_id)
    equity_grant = EquityGrant.find(equity_grant_id)
    EquityGrant::UpdateVestedShares.new(equity_grant:).process
  end
end
