# frozen_string_literal: true

class Internal::Companies::DividendComputationsController < Internal::Companies::BaseController
  before_action :set_dividend_computation, only: [:per_investor]

  def create
    authorize DividendComputation

    dividend_computation = DividendComputationGeneration.new(
      Current.company,
      dividends_issuance_date: dividend_computation_params[:dividends_issuance_date] || Date.current,
      amount_in_usd: dividend_computation_params[:amount_in_usd],
      return_of_capital: dividend_computation_params[:return_of_capital],
      name: dividend_computation_params[:name]
    ).process

    render json: { id: dividend_computation.id }, status: :created
  rescue StandardError => e
    render json: { error_message: e.message }, status: :unprocessable_entity
  end

  def per_investor
    authorize @dividend_computation

    aggregated_data = @dividend_computation.to_per_investor
    render json: aggregated_data
  end

  private
    def set_dividend_computation
      @dividend_computation = Current.company.dividend_computations.find(params[:id])
    end

    def dividend_computation_params
      params.require(:dividend_computation).permit(:amount_in_usd, :dividends_issuance_date, :return_of_capital, :name)
    end
end
