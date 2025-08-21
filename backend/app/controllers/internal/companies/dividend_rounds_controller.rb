# frozen_string_literal: true

class Internal::Companies::DividendRoundsController < Internal::Companies::BaseController
  before_action :load_dividend_computation, only: [:create]

  def create
    authorize DividendRound
    result = CreateDividendRound.new(@dividend_computation).process

    if result[:success]
      render json: { id: result[:dividend_round].external_id }, status: :created
    else
      render json: { error: result[:error] }, status: :unprocessable_entity
    end
  end

  private
    def load_dividend_computation
      @dividend_computation =
        Current.company.dividend_computations.find_by!(external_id: params[:dividend_computation_id])
    end
end
