# frozen_string_literal: true

class Internal::Companies::EquityExercisePaymentsController < Internal::Companies::BaseController
  def update
    exercise = Current.company.equity_grant_exercises.find(params[:id])
    authorize exercise, :process?

    result = EquityExercisingService.new(exercise).process

    if result[:success]
      head :ok
    else
      render json: { error: result[:error] }, status: :unprocessable_entity
    end
  end
end
