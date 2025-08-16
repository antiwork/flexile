# frozen_string_literal: true

class Internal::Companies::DividendComputationsController < Internal::Companies::BaseController
  def index
    authorize DividendComputation, :index?
    computations = policy_scope(Current.company.dividend_computations).order(created_at: :desc)
    render json: computations.map { |computation| DividendComputationPresenter.new(computation).summary }
  end

  def show
    computation = Current.company.dividend_computations.find(params[:id])
    authorize computation
    render json: DividendComputationPresenter.new(computation).detailed_view
  end

  def create
    authorize DividendComputation

    service = DividendComputationGeneration.new(
      Current.company,
      amount_in_usd: params[:total_amount_in_usd].to_d,
      dividends_issuance_date: Date.parse(params[:dividends_issuance_date]),
      return_of_capital: params[:return_of_capital] || false
    )

    computation = service.process

    render json: DividendComputationPresenter.new(computation).summary, status: :created
  rescue Date::Error => e
    render json: { error: "Invalid date format: #{e.message}" }, status: :bad_request
  rescue ArgumentError => e
    render json: { error: "Invalid parameters: #{e.message}" }, status: :bad_request
  rescue StandardError => e
    Rails.logger.error "Dividend computation creation failed: #{e.message}"
    render json: { error: "Failed to create dividend computation" }, status: :internal_server_error
  end

  def destroy
    computation = Current.company.dividend_computations.find(params[:id])
    authorize computation

    computation.destroy!
    render json: { success: true }
  rescue ActiveRecord::RecordNotDestroyed => e
    render json: { error: "Failed to delete computation: #{e.message}" }, status: :unprocessable_entity
  end

  def preview
    authorize DividendComputation, :preview?

    # Generate preview without saving to database
    DividendComputationGeneration.new(
      Current.company,
      amount_in_usd: params[:total_amount_in_usd].to_d,
      dividends_issuance_date: Date.parse(params[:dividends_issuance_date]),
      return_of_capital: params[:return_of_capital] || false
    )

    # Preview mode implementation needed in DividendComputationGeneration service
    # For now, return mock data
    render json: {
      total_amount_in_usd: params[:total_amount_in_usd].to_d,
      dividends_issuance_date: params[:dividends_issuance_date],
      return_of_capital: params[:return_of_capital] || false,
      estimated_shareholders: Current.company.share_holdings.joins(:company_investor).distinct.count(:company_investor_id),
      estimated_processing_time: "2-3 business days",
    }
  rescue Date::Error => e
    render json: { error: "Invalid date format: #{e.message}" }, status: :bad_request
  rescue ArgumentError => e
    render json: { error: "Invalid parameters: #{e.message}" }, status: :bad_request
  end

  def finalize
    computation = Current.company.dividend_computations.find(params[:id])
    authorize computation, :update?

    # Generate dividend round and individual dividends from computation
    dividend_round = nil

    ActiveRecord::Base.transaction do
      # Create the dividend round
      dividend_round = Current.company.dividend_rounds.create!(
        total_amount_in_cents: (computation.total_amount_in_usd * 100).to_i,
        issued_at: computation.dividends_issuance_date,
        number_of_shareholders: computation.dividend_computation_outputs.count,
        number_of_shares: computation.dividend_computation_outputs.sum(:number_of_shares),
        status: "Issued",
        return_of_capital: computation.return_of_capital || false
      )

      # Keep track of company investors for investor dividend rounds
      company_investors = []

      # Create individual dividend records for each output
      computation.dividend_computation_outputs.each do |output|
        company_investor = output.company_investor

        # Skip if no company investor (might be convertible investment)
        next unless company_investor

        company_investors << company_investor

        Rails.logger.info "Creating dividend for company_investor #{company_investor.id}"
        Rails.logger.info "Dividend data: total_amount_in_cents=#{(output.total_amount_in_usd * 100).to_i}, number_of_shares=#{output.number_of_shares}, qualified_amount_cents=#{(output.qualified_dividend_amount_usd * 100).to_i}"

        begin
          dividend = dividend_round.dividends.create!(
            company: dividend_round.company,
            company_investor: company_investor,
            total_amount_in_cents: (output.total_amount_in_usd * 100).to_i,
            number_of_shares: output.number_of_shares,
            qualified_amount_cents: (output.qualified_dividend_amount_usd * 100).to_i,
            status: Dividend::ISSUED
          )
          Rails.logger.info "Successfully created dividend #{dividend.id}"
        rescue ActiveRecord::RecordInvalid => e
          Rails.logger.error "Failed to create dividend: #{e.message}"
          Rails.logger.error "Validation errors: #{e.record.errors.full_messages.join(', ')}"
          raise e
        rescue StandardError => e
          Rails.logger.error "Unexpected error creating dividend: #{e.class.name}: #{e.message}"
          raise e
        end
      end

      # Create InvestorDividendRound records for email notifications
      company_investors.uniq.each do |company_investor|
        dividend_round.investor_dividend_rounds.create!(
          company_investor: company_investor,
          dividend_issued_email_sent: false,
          sanctioned_country_email_sent: false,
          payout_below_threshold_email_sent: false
        )
      end

      # Process payment: Pull money from company + create Stripe payout
      begin
        Rails.logger.info "About to process payment for dividend round #{dividend_round.id}"
        payment_service = ProcessDividendPayment.new(dividend_round)
        payment_result = payment_service.process!
        Rails.logger.info "Dividend payment processed successfully for round #{dividend_round.id}: #{payment_result}"
      rescue ProcessDividendPayment::Error => e
        Rails.logger.error "Payment processing failed for dividend round #{dividend_round.id}: #{e.message}"
        Rails.logger.error "Payment error backtrace: #{e.backtrace.join("\n")}"
        # Continue with dividend creation but mark payment as failed
        dividend_round.update!(ready_for_payment: false)
        { error: e.message }
      rescue StandardError => e
        Rails.logger.error "Unexpected error during payment processing: #{e.class.name}: #{e.message}"
        Rails.logger.error "Unexpected error backtrace: #{e.backtrace.join("\n")}"
        dividend_round.update!(ready_for_payment: false)
        { error: e.message }
      end
    end

    # Send dividend issuance emails to all investors (after successful transaction)
    dividend_round.investor_dividend_rounds.each do |investor_dividend_round|
      investor_dividend_round.send_dividend_issued_email
    end

    # Include payment information in response
    response_data = DividendRoundPresenter.new(dividend_round).summary
    response_data[:payment_result] = payment_result if payment_result

    render json: response_data, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: "Failed to create dividend round: #{e.message}" }, status: :unprocessable_entity
  rescue StandardError => e
    Rails.logger.error "Dividend finalization failed: #{e.message}"
    render json: { error: "Failed to finalize dividend computation" }, status: :internal_server_error
  end

  def export_csv
    computation = Current.company.dividend_computations.find(params[:id])
    authorize computation, :show?

    # Generate CSV data from computation outputs
    csv_data = generate_csv_data(computation)

    send_data csv_data,
              filename: "dividend_computation_#{computation.id}_#{Date.current.strftime('%Y%m%d')}.csv",
              type: "text/csv",
              disposition: "attachment"
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Dividend computation not found" }, status: :not_found
  rescue StandardError => e
    Rails.logger.error "CSV export failed: #{e.message}"
    render json: { error: "Failed to export CSV" }, status: :internal_server_error
  end

  private
    def generate_csv_data(computation)
      require "csv"

      CSV.generate(headers: true) do |csv|
        # Header row
        csv << [
          "Investor Name",
          "Email",
          "Share Class",
          "Number of Shares",
          "Total Amount (USD)",
          "Qualified Dividend Amount (USD)",
          "Non-Qualified Dividend Amount (USD)",
          "Percentage of Total",
          "Investment Amount (USD)",
          "ROI to Date (%)"
        ]

        # Data rows
        computation.dividend_computation_outputs.includes(company_investor: :user).each do |output|
          company_investor = output.company_investor
          next unless company_investor # Skip if no company investor

          user = company_investor.user
          non_qualified_amount = output.total_amount_in_usd - output.qualified_dividend_amount_usd
          percentage_of_total = computation.total_amount_in_usd > 0 ? (output.total_amount_in_usd / computation.total_amount_in_usd * 100).round(4) : 0
          investment_amount = company_investor.investment_amount_in_cents / 100.0
          roi_percentage = company_investor&.cumulative_dividends_roi ? (company_investor.cumulative_dividends_roi * 100.0) : 0.0

          csv << [
            user.name,
            user.email,
            output.share_class || "Common",
            output.number_of_shares,
            output.total_amount_in_usd,
            output.qualified_dividend_amount_usd,
            non_qualified_amount,
            "#{percentage_of_total}%",
            investment_amount,
            "#{roi_percentage.round(2)}%"
          ]
        end

        # Summary row
        total_shares = computation.dividend_computation_outputs.sum(:number_of_shares)
        total_qualified = computation.dividend_computation_outputs.sum(:qualified_dividend_amount_usd)
        total_non_qualified = computation.total_amount_in_usd - total_qualified

        csv << []
        csv << ["TOTALS", "", "", total_shares, computation.total_amount_in_usd, total_qualified, total_non_qualified, "100.0%", "", ""]
      end
    end
end
