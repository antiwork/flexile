# frozen_string_literal: true

class Internal::Companies::DividendComputationsController < Internal::Companies::BaseController
  def index
    authorize DividendComputation, :index?
    computations = policy_scope(Current.company.dividend_computations).includes(:dividend_computation_outputs).order(created_at: :desc)
    render json: computations.map { |computation| DividendComputationPresenter.new(computation).summary }
  end

  def show
    computation = Current.company.dividend_computations.find(params[:id])
    authorize computation
    render json: DividendComputationPresenter.new(computation).detailed_view
  end

  def create
    authorize DividendComputation

    total_amount_param = params.require(:total_amount_in_usd)
    issuance_date_param = params.require(:dividends_issuance_date)
    service = DividendComputationGeneration.new(
      Current.company,
      amount_in_usd: BigDecimal(total_amount_param.to_s),
      dividends_issuance_date: Date.iso8601(issuance_date_param),
      return_of_capital: ActiveModel::Type::Boolean.new.cast(params[:return_of_capital])
    ) # TODO (techdebt): extract param coercion into a strong params method

    computation = service.process

    render json: DividendComputationPresenter.new(computation).summary, status: :created
  rescue ActionController::ParameterMissing => e
    render json: { error: e.message }, status: :bad_request
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

    safe_params = {
      amount_in_usd: BigDecimal(params.require(:total_amount_in_usd).to_s),
      dividends_issuance_date: Date.iso8601(params.require(:dividends_issuance_date)),
      return_of_capital: ActiveModel::Type::Boolean.new.cast(params[:return_of_capital]),
    } # TODO (techdebt): extract param coercion into a strong params method

    render json: {
      total_amount_in_usd: safe_params[:amount_in_usd],
      dividends_issuance_date: safe_params[:dividends_issuance_date].iso8601,
      return_of_capital: safe_params[:return_of_capital],
      estimated_shareholders: Current.company.share_holdings.joins(:company_investor).distinct.count(:company_investor_id),
      estimated_processing_time: "2-3 business days",
    }
  rescue ActionController::ParameterMissing => e
    render json: { error: "Missing required parameters: #{e.message}" }, status: :bad_request
  rescue Date::Error => e
    render json: { error: "Invalid date format: #{e.message}" }, status: :bad_request
  rescue ArgumentError => e
    render json: { error: "Invalid parameters: #{e.message}" }, status: :bad_request
  end

  def finalize
    computation = Current.company.dividend_computations.find(params[:id])
    authorize computation, :finalize?

    # TODO (techdebt): Extract finalize orchestration into a service
    payment_result = nil
    dividend_round = nil

    ActiveRecord::Base.transaction do
      dividend_round = Current.company.dividend_rounds.create!(
        total_amount_in_cents: (computation.total_amount_in_usd * 100).round,
        issued_at: computation.dividends_issuance_date,
        number_of_shareholders: computation.dividend_computation_outputs.count,
        number_of_shares: computation.dividend_computation_outputs.sum(:number_of_shares),
        status: "Issued",
        return_of_capital: computation.return_of_capital || false
      )

      company_investors = []

      computation.dividend_computation_outputs.includes(:company_investor).each do |output|
        company_investor = output.company_investor

        next unless company_investor

        company_investors << company_investor

        Rails.logger.info "Creating dividend for company_investor #{company_investor.id}"
        Rails.logger.info "Dividend data: total_amount_in_cents=#{(output.total_amount_in_usd * 100).round}, number_of_shares=#{output.number_of_shares}, qualified_amount_cents=#{(output.qualified_dividend_amount_usd * 100).round}"

        begin
          dividend = dividend_round.dividends.create!(
            company: dividend_round.company,
            company_investor: company_investor,
            total_amount_in_cents: (output.total_amount_in_usd * 100).round,
            number_of_shares: output.number_of_shares,
            qualified_amount_cents: (output.qualified_dividend_amount_usd * 100).round,
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

      company_investors.uniq.each do |company_investor|
        dividend_round.investor_dividend_rounds.create!(
          company_investor: company_investor,
          dividend_issued_email_sent: false,
          sanctioned_country_email_sent: false,
          payout_below_threshold_email_sent: false
        )
      end
    end

    begin
      Rails.logger.info "About to process payment for dividend round #{dividend_round.id}"
      payment_service = ProcessDividendPayment.new(dividend_round)
      payment_result = payment_service.process!
      Rails.logger.info "Dividend payment processed successfully for round #{dividend_round.id}: #{payment_result}"
    rescue ProcessDividendPayment::Error => e
      Rails.logger.error "Payment processing failed for dividend round #{dividend_round.id}: #{e.message}"
      Rails.logger.error "Payment error backtrace: #{e.backtrace.join("\n")}"
      dividend_round.update!(ready_for_payment: false)
      payment_result = { error: e.message }
    rescue StandardError => e
      Rails.logger.error "Unexpected error during payment processing: #{e.class.name}: #{e.message}"
      Rails.logger.error "Unexpected error backtrace: #{e.backtrace.join("\n")}"
      dividend_round.update!(ready_for_payment: false)
      payment_result = { error: e.message }
    end

    # Only send emails if payment was successful
    if payment_result && !payment_result.key?(:error)
      dividend_round.investor_dividend_rounds.each do |investor_dividend_round|
        investor_dividend_round.send_dividend_issued_email
      end
    end

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

    # TODO (techdebt): Move CSV generation into presenter/service
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
    # TODO (techdebt): Move CSV generation into presenter/service
    def generate_csv_data(computation)
      require "csv"

      CSV.generate(headers: true) do |csv|
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

        computation.dividend_computation_outputs.includes(company_investor: :user).each do |output|
          company_investor = output.company_investor
          next unless company_investor

          user = company_investor.user
          non_qualified_amount = output.total_amount_in_usd - output.qualified_dividend_amount_usd
          percentage_of_total = computation.total_amount_in_usd > 0 ? (output.total_amount_in_usd / computation.total_amount_in_usd * 100).round(4) : 0
          investment_amount = (company_investor.investment_amount_in_cents.to_i / 100.0)
          roi_percentage = company_investor&.cumulative_dividends_roi ? (company_investor.cumulative_dividends_roi * 100.0) : 0.0

          csv << [
            user&.name.to_s,
            user&.email.to_s,
            output.share_class || "Common",
            output.number_of_shares,
            ("%.2f" % output.total_amount_in_usd),
            ("%.2f" % output.qualified_dividend_amount_usd),
            ("%.2f" % non_qualified_amount),
            "#{percentage_of_total}%",
            ("%.2f" % investment_amount),
            ("%.2f" % roi_percentage.round(2)) + "%"
          ]
        end

        total_shares = computation.dividend_computation_outputs.sum(:number_of_shares)
        total_qualified = computation.dividend_computation_outputs.sum(:qualified_dividend_amount_usd)
        total_non_qualified = computation.total_amount_in_usd - total_qualified

        csv << []
        csv << ["TOTALS", "", "", total_shares, ("%.2f" % computation.total_amount_in_usd), ("%.2f" % total_qualified), ("%.2f" % total_non_qualified), "100.0%", "", ""]
      end
    end
end
