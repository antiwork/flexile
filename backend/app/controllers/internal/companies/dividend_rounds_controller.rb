# frozen_string_literal: true

class Internal::Companies::DividendRoundsController < Internal::Companies::BaseController
  def payment_status
    dividend_round = find_dividend_round
    authorize dividend_round, :show?

    # Get payment status for all dividends in this round
    dividends = dividend_round.dividends.includes(:company_investor, :dividend_payments)

    payment_stats = {
      total_amount_cents: dividends.sum(:total_amount_in_cents),
      total_recipients: dividends.count,
      pending: dividends.where(status: [Dividend::CREATED, Dividend::ISSUED]).count,
      processing: dividends.where(status: Dividend::PROCESSING).count,
      completed: dividends.where(status: Dividend::PAID).count,
      failed: dividends.joins(:dividend_payments).where(dividend_payments: { status: Payment::FAILED }).count,
      retained: dividends.where(status: Dividend::RETAINED).count
    }
    render json: payment_stats
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Dividend round not found" }, status: :not_found
  end

  def process_payments
    dividend_round = find_dividend_round
    authorize dividend_round, :update?

    # Mark round as ready for payment and trigger payment processing
    dividend_round.update!(ready_for_payment: true)

    # Queue the payment job to process all ready dividends
    PayAllDividendsJob.perform_async

    # Count how many payments were queued
    ready_dividends = dividend_round.dividends
                                  .joins(company_investor: { user: :bank_accounts })
                                  .where(status: [Dividend::ISSUED])
                                  .where.not(users: { tax_information_confirmed_at: nil })
                                  .where.not(bank_accounts: { id: nil })
    render json: {
      success: true,
      dividend_round_id: dividend_round.id,
      payments_queued: ready_dividends.count,
      message: "Payment processing initiated",
    }
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Dividend round not found" }, status: :not_found
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: "Failed to process payments: #{e.message}" }, status: :unprocessable_entity
  rescue StandardError => e
    Rails.logger.error "Failed to process payments for dividend round #{params[:id]}: #{e.message}"
    render json: { error: "Failed to process payments" }, status: :internal_server_error
  end

  private

  def find_dividend_round
    Current.company.dividend_rounds.find(params[:id])
  end
end