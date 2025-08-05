# frozen_string_literal: true

class CancelEquityGrant
  def initialize(equity_grant:, reason:)
    @equity_grant = equity_grant
    @reason = reason
  end

  def process
    equity_grant.with_lock do
      forfeited_shares = equity_grant.unvested_shares
      total_forfeited_shares = forfeited_shares + equity_grant.forfeited_shares

      vesting_events = equity_grant.vesting_events.unprocessed.not_cancelled.where("DATE(vesting_date) > ?", Date.current)
      vesting_events.each do |vesting_event|
        vesting_event.with_lock do
          vesting_event.mark_cancelled!(reason:)
        end
      end
      equity_grant.update!(forfeited_shares: total_forfeited_shares, unvested_shares: 0, cancelled_at: Time.current)
      equity_grant.option_pool.decrement!(:issued_shares, forfeited_shares)
    end
  end

  private
    attr_reader :equity_grant, :reason
end
