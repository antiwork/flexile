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

      equity_grant.equity_grant_transactions.create!(
        transaction_type: EquityGrantTransaction.transaction_types[:cancellation],
        forfeited_shares:,
        total_number_of_shares: equity_grant.number_of_shares,
        total_vested_shares: equity_grant.vested_shares,
        total_unvested_shares: 0,
        total_exercised_shares: equity_grant.exercised_shares,
        total_forfeited_shares:,
      )
      vesting_events = equity_grant.vesting_events.unprocessed.not_cancelled.where("DATE(vesting_date) > ?", Date.current)
      vesting_events.each do |vesting_event|
        vesting_event.with_lock do
          vesting_event.mark_cancelled!(reason:)
        end
      end
      equity_grant.update!(forfeited_shares: total_forfeited_shares, unvested_shares: 0)
      equity_grant.option_pool.decrement!(:issued_shares, forfeited_shares)
    end
  end

  private
    attr_reader :equity_grant, :reason
end
