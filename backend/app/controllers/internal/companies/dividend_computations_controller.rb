# frozen_string_literal: true

class Internal::Companies::DividendComputationsController < Internal::Companies::BaseController
  before_action :load_computation!, only: [:show]

  def index
    authorize DividendComputation
    computations = Current.company.dividend_computations
                                  .includes(:dividend_computation_outputs)
                                  .order(created_at: :desc)

    render json: {
      dividend_computations: computations.map { |c| DividendComputationPresenter.new(c).props },
    }
  end

  def create
    authorize DividendComputation

    begin
      computation = DividendComputationGeneration.new(
        Current.company,
        amount_in_usd: create_params[:amount_in_usd],
        dividends_issuance_date: create_params[:issued_at],
        return_of_capital: create_params[:return_of_capital],
        release_document: create_params[:release_document]
      ).process

      render json: {
        success: true,
        dividend_computation: DividendComputationPresenter.new(computation).props,
      }
    rescue ActiveRecord::RecordInvalid => e
      render json: {
        success: false,
        error_message: e.message,
      }, status: :unprocessable_entity
    end
  end

  def show
    authorize @computation

    render json: {
      dividend_computation: DividendComputationPresenter.new(@computation, include_outputs: true).props,
    }
  end

  private
    def load_computation!
      @computation = Current.company.dividend_computations
                                    .includes(dividend_computation_outputs: { company_investor: :user })
                                    .find_by!(external_id: params[:id])
    end

    def create_params
      params.require(:dividend_computation).permit(
        :amount_in_usd,
        :issued_at,
        :return_of_capital,
        :release_document
      )
    end
end
