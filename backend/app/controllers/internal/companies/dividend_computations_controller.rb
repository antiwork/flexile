# frozen_string_literal: true

class Internal::Companies::DividendComputationsController < Internal::Companies::BaseController
  before_action :set_dividend_computation, only: [:show]

  def index
    authorize DividendComputation

    dividend_computations = Current.company.dividend_computations
      .with_shareholder_count
      .order(id: :desc)
      .map do |computation|
      DividendComputationPresenter.new(computation).props
    end

    render json: dividend_computations
  end

  def create
    authorize DividendComputation

    dividend_computation = DividendComputationGeneration.new(
      Current.company,
      dividends_issuance_date: dividend_computation_params[:dividends_issuance_date]&.to_date || Date.current,
      amount_in_usd: dividend_computation_params[:amount_in_usd],
      return_of_capital: dividend_computation_params[:return_of_capital]
    ).process

    render json: { id: dividend_computation.id }, status: :created
  end

  def show
    authorize @dividend_computation

    computation_data = DividendComputationPresenter.new(@dividend_computation).props
    computation_outputs = @dividend_computation.broken_down_by_investor

    render json: computation_data.merge(computation_outputs:)
  end

  private
    def set_dividend_computation
      @dividend_computation = Current.company.dividend_computations.find(params[:id])
    end

    def dividend_computation_params
      params.require(:dividend_computation).permit(:amount_in_usd, :dividends_issuance_date, :return_of_capital)
    end
end
