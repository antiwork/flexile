# frozen_string_literal: true

class Internal::WiseAccountRequirementsController < Internal::BaseController
  skip_before_action :force_onboarding
  skip_before_action :set_paper_trail_whodunnit

  def create
    result = Wise::PayoutApi.new(wise_credential: nil).account_requirements(**account_params.to_h.symbolize_keys)
    render json: result.body, status: result.code
  end

  private
    def account_params
      params.require(:wise_account_requirement).permit(:source, :source_amount, :target, :type, details: {})
    end
end
