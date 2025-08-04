# frozen_string_literal: true

class Internal::Companies::DividendComputationsController < Internal::Companies::BaseController
  def create
    authorize DividendComputation

    dividend_computation = DividendComputationGeneration.new(
      Current.company,
      dividends_issuance_date: dividend_computation_params[:dividends_issuance_date] || Date.current,
      amount_in_usd: dividend_computation_params[:amount_in_usd],
      return_of_capital: dividend_computation_params[:return_of_capital],
      release_document: dividend_computation_params[:release_document],
      name: dividend_computation_params[:name]
    ).process

    render json: { id: dividend_computation.id }, status: :created
  rescue StandardError
    head :unprocessable_entity
  end

  private
    def dividend_computation_params
      params.require(:dividend_computation).permit(:amount_in_usd, :dividends_issuance_date, :return_of_capital, :release_document, :name)
    end
end
