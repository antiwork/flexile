# frozen_string_literal: true

class Internal::Companies::DividendComputationsController < Internal::Companies::BaseController
  before_action :load_dividend_computation, only: [:show]

  def index
    authorize DividendComputation

    dividend_computations = Current.company.dividend_computations
      .includes(:dividend_computation_outputs)
      .order(created_at: :desc)
      .map do |computation|
      DividendComputationPresenter.new(computation).index_props
    end

    render json: dividend_computations
  end

  def create
    authorize DividendComputation

    dividend_computation = DividendComputationGeneration.new(
      Current.company,
      dividends_issuance_date: dividend_computation_params[:dividends_issuance_date]&.to_date,
      amount_in_usd: dividend_computation_params[:amount_in_usd],
      return_of_capital: dividend_computation_params[:return_of_capital]
    ).process

    render json: { id: dividend_computation.id }, status: :created
  end

  def show
    authorize @dividend_computation
    render json: DividendComputationPresenter.new(@dividend_computation).props
  end

  private
    def load_dividend_computation
      @dividend_computation = Current.company.dividend_computations.find(params[:id])
    end

    def dividend_computation_params
      params.require(:dividend_computation).permit(:amount_in_usd, :dividends_issuance_date, :return_of_capital)
    end
end
