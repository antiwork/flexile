# frozen_string_literal: true

class Internal::Companies::DividendComputationsController < Internal::Companies::BaseController
  def create
    authorize DividendComputation

    dividend_computation = DividendComputationGeneration.new(
      Current.company,
      amount_in_usd: dividend_computation_params[:amount_in_usd],
      dividends_issuance_date: dividend_computation_params[:dividends_issuance_date] || Date.current,
      return_of_capital: dividend_computation_params[:return_of_capital],
      release_document: dividend_computation_params[:release_document]
    ).process

    render json: { id: dividend_computation.id }, status: :created
  rescue StandardError
    head :unprocessable_entity
  end

  private
    def dividend_computation_params
      params.require(:dividend_computation).permit(:amount_in_usd, :dividends_issuance_date, :return_of_capital, :release_document)
    end
end
