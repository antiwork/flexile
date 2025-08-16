# frozen_string_literal: true

class Internal::Companies::DividendRoundsController < Internal::Companies::BaseController
  def payment_status
    dividend_round = find_dividend_round
    authorize dividend_round, :show?

    # Get payment status for all dividends in this round
    dividends = dividend_round.dividends.includes(:company_investor, :dividend_payments)

    # Use grouped counts to reduce N+1 queries
    status_counts = dividends.group(:status).count
    
    payment_stats = {
      total_amount_cents: dividends.sum(:total_amount_in_cents),
      total_recipients: dividends.count,
      pending: (status_counts[Dividend::CREATED] || 0) + (status_counts[Dividend::ISSUED] || 0),
      processing: status_counts[Dividend::PROCESSING] || 0,
      completed: status_counts[Dividend::PAID] || 0,
      failed: dividends.joins(:dividend_payments).where(dividend_payments: { status: Payment::FAILED }).distinct.count,
      retained: status_counts[Dividend::RETAINED] || 0,
    }
    render json: payment_stats
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Dividend round not found" }, status: :not_found
  rescue StandardError => e
    Rails.logger.error "Failed to get payment status for dividend round #{params[:id]}: #{e.full_message}"
    render json: { error: "Failed to get payment status" }, status: :internal_server_error
  end

  def process_payments
    dividend_round = find_dividend_round
    authorize dividend_round, :update?

    # Mark round as ready for payment and trigger payment processing
    dividend_round.update!(ready_for_payment: true)

    # Queue the payment job to process dividends for this specific round
    PayAllDividendsJob.perform_async(dividend_round.id)

    # Count how many payments were queued (using distinct to avoid duplicate counting from bank account joins)
    ready_dividends = dividend_round.dividends
                                  .joins(company_investor: { user: :bank_accounts })
                                  .where(status: [Dividend::ISSUED])
                                  .where.not(users: { tax_information_confirmed_at: nil })
                                  .where.not(bank_accounts: { id: nil })
                                  .distinct
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
    Rails.logger.error "Failed to process payments for dividend round #{params[:id]}: #{e.full_message}"
    render json: { error: "Failed to process payments" }, status: :internal_server_error
  end

  private
    def find_dividend_round
      Current.company.dividend_rounds.find(params[:id])
    end
end
