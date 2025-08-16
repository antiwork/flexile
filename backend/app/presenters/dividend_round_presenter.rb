# frozen_string_literal: true

class DividendRoundPresenter < BasePresenter
  def initialize(dividend_round)
    super(dividend_round)
    @dividend_round = dividend_round
  end

  def summary
    base_fields_with_external_id.merge(
      total_amount_in_cents: @dividend_round.total_amount_in_cents,
      total_amount_in_usd: cents_to_usd(@dividend_round.total_amount_in_cents),
      issued_at: serialize_date(@dividend_round.issued_at),
      number_of_shareholders: @dividend_round.number_of_shareholders,
      number_of_shares: @dividend_round.number_of_shares,
      status: @dividend_round.status,
      return_of_capital: @dividend_round.return_of_capital,
      ready_for_payment: @dividend_round.ready_for_payment,
      payment_fees: calculate_payment_fees,
    )
  end

  def detailed_view
    summary.merge(
      dividends: dividends_summary,
      investor_dividend_rounds: investor_dividend_rounds_summary,
    )
  end

  private
    def dividends_summary
      @dividend_round.dividends.includes(company_investor: :user).map do |dividend|
        {
          id: dividend.id,
          investor_name: dividend&.company_investor&.user&.name,
          investor_email: dividend&.company_investor&.user&.email,
          total_amount_in_cents: dividend.total_amount_in_cents,
          total_amount_in_usd: cents_to_usd(dividend.total_amount_in_cents),
          number_of_shares: dividend.number_of_shares,
          qualified_amount_cents: dividend.qualified_amount_cents.to_i,
          qualified_amount_usd: cents_to_usd(dividend.qualified_amount_cents.to_i),
          non_qualified_dividend_amount_in_usd: cents_to_usd(dividend.total_amount_in_cents - dividend.qualified_amount_cents.to_i),
          status: dividend.status || "pending",
        }
      end
    end

    def investor_dividend_rounds_summary
      @dividend_round.investor_dividend_rounds.includes(company_investor: :user).map do |idr|
        {
          investor_name: idr&.company_investor&.user&.name,
          dividend_issued_email_sent: idr.dividend_issued_email_sent,
          sanctioned_country_email_sent: idr.sanctioned_country_email_sent,
          payout_below_threshold_email_sent: idr.payout_below_threshold_email_sent,
        }
      end
    end

    def calculate_payment_fees
      dividend_amount = @dividend_round.total_amount_in_cents
      processing_fee = (dividend_amount * 0.029).round + 30
      transfer_fee = 500
      total_with_fees = dividend_amount + processing_fee + transfer_fee

      {
        dividend_amount_cents: dividend_amount,
        dividend_amount_usd: cents_to_usd(dividend_amount),
        processing_fee_cents: processing_fee,
        processing_fee_usd: cents_to_usd(processing_fee),
        transfer_fee_cents: transfer_fee,
        transfer_fee_usd: cents_to_usd(transfer_fee),
        total_with_fees_cents: total_with_fees,
        total_with_fees_usd: cents_to_usd(total_with_fees),
      }
    end
end
