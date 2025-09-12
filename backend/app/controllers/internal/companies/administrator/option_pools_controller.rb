# frozen_string_literal: true

class Internal::Companies::Administrator::OptionPoolsController < Internal::Companies::BaseController
  def create
    authorize OptionPool

    share_class = Current.company.share_classes.find_by(id: params[:option_pool][:share_class_id])

    result = CreateOptionPool.new(
      company: Current.company,
      **option_pool_params.to_h.symbolize_keys.merge(share_class:)
    ).process

    if result[:success]
      render json: result
    else
      render_error_response(result[:error])
    end
  rescue ActiveRecord::RecordInvalid => e
    error = e.record.errors.first
    render_error_response(error.message, attribute_name: error.attribute)
  end

  private
    def option_pool_params
      params.require(:option_pool).permit(
        :name,
        :authorized_shares,
        :default_option_expiry_months,
        :voluntary_termination_exercise_months,
        :involuntary_termination_exercise_months,
        :termination_with_cause_exercise_months,
        :death_exercise_months,
        :disability_exercise_months,
        :retirement_exercise_months
      )
    end

    def render_error_response(error, attribute_name: nil)
      render json: { error:, attribute_name: }, status: :unprocessable_entity
    end
end
