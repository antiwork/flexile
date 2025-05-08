# frozen_string_literal: true

class Internal::Companies::EquityGrantExercisesController < Internal::Companies::BaseController
  before_action :load_equity_grant_exercise!, only: [:resend]


  def create
    authorize EquityGrantExercise

    result = EquityExercisingService.create_request(equity_grants_params:,
                                                    submission_id: params[:submission_id],
                                                    company_investor: Current.company_investor!,
                                                    company_worker: Current.company_worker!)

    if result[:success]
      render json: { id: result[:exercise].id }
    else
      render json: { error: result[:error] }, status: :unprocessable_entity
    end
  end

  def resend
    authorize @equity_grant_exercise

    CompanyInvestorMailer.stock_exercise_payment_instructions(Current.company_investor!.id, exercise_id: @equity_grant_exercise.id).deliver_later
  end

  private
    def load_equity_grant_exercise!
      @equity_grant_exercise = Current.company_investor!.equity_grant_exercises.find(params[:id])
    end

    def equity_grants_params
      params.permit(equity_grants: [:id, :number_of_options]).require(:equity_grants)
    end
end
