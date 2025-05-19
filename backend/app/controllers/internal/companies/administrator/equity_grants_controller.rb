# frozen_string_literal: true

class Internal::Companies::Administrator::EquityGrantsController < Internal::Companies::BaseController
  def create
    authorize EquityGrant

    company_worker = Current.company.company_workers.find_by(external_id: params[:equity_grant][:company_worker_id])
    option_pool = Current.company.option_pools.find_by(external_id: params[:equity_grant][:option_pool_id])

    result = GrantStockOptions.new(
      company_worker,
      **equity_grant_params.to_h.symbolize_keys.merge(option_pool:, vesting_schedule_params:)
    ).process

    if result[:success]
      render json: { equity_grant_id: result[:equity_grant_id] }
    else
      render_error_response(result[:error])
    end
  rescue ActiveRecord::RecordInvalid => e
    error = e.record.errors.first
    render_error_response(error.message, attribute_name: error.attribute)
  end

  private
    def equity_grant_params
      params.require(:equity_grant).permit(
        :number_of_shares,
        :issue_date_relationship,
        :option_grant_type,
        :option_expiry_months,
        :vesting_trigger,
        :voluntary_termination_exercise_months,
        :involuntary_termination_exercise_months,
        :termination_with_cause_exercise_months,
        :death_exercise_months,
        :disability_exercise_months,
        :retirement_exercise_months,
        :board_approval_date,
        :vesting_commencement_date,
      )
    end

    def vesting_schedule_params
      params.require(:equity_grant).permit(
        :vesting_schedule_id,
        :total_vesting_duration_months,
        :cliff_duration_months,
        :vesting_frequency_months,
      )
    end

    def render_error_response(error, attribute_name: nil)
      render json: { error:, attribute_name: }, status: :unprocessable_entity
    end
end
