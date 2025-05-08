# frozen_string_literal: true

class EquityGrant::UpdateVestedShares
  attr_reader :equity_grant, :invoice, :post_invoice_payment_vesting_event

  def initialize(equity_grant:, invoice: nil, post_invoice_payment_vesting_event: nil)
    @equity_grant = equity_grant
    @invoice = invoice
    @post_invoice_payment_vesting_event = post_invoice_payment_vesting_event
  end

  def process
    current_date = Date.current
    newly_vested_events = if invoice
      [post_invoice_payment_vesting_event].compact
    else
      equity_grant.vesting_events
                .unprocessed
                .not_cancelled
                .where("DATE(vesting_date) <= ?", current_date)
                .order(vesting_date: :asc)
    end
    return if newly_vested_events.empty?

    ActiveRecord::Base.transaction do
      transaction_type = EquityGrantTransaction.transaction_types[invoice ? :vesting_post_invoice_payment : :scheduled_vesting]
      total_vested_shares = equity_grant.vested_shares
      total_unvested_shares = equity_grant.unvested_shares

      newly_vested_events.each do |vesting_event|
        if vesting_event.vested_shares > total_unvested_shares
          vesting_event.with_lock do
            vesting_event.mark_cancelled!(reason: VestingEvent::CANCELLATION_REASONS[:not_enough_shares_available])
          end
          next
        end

        total_vested_shares += vesting_event.vested_shares
        total_unvested_shares -= vesting_event.vested_shares

        equity_grant.equity_grant_transactions.create!(
          transaction_type:,
          vesting_event:,
          invoice:,
          vested_shares: vesting_event.vested_shares,
          total_number_of_shares: equity_grant.number_of_shares,
          total_vested_shares:,
          total_unvested_shares:,
          total_exercised_shares: equity_grant.exercised_shares,
          total_forfeited_shares: equity_grant.forfeited_shares,
        )

        vesting_event.with_lock do
          vesting_event.mark_as_processed!
        end

        equity_grant.with_lock do
          equity_grant.update!(
            vested_shares: equity_grant.vested_shares + vesting_event.vested_shares,
            unvested_shares: equity_grant.unvested_shares - vesting_event.vested_shares
          )
        end
      end
    end
  end
end
