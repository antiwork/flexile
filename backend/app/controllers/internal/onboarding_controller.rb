# frozen_string_literal: true

class Internal::OnboardingController < Internal::BaseController
  skip_before_action :force_onboarding

  before_action :authenticate_user_json!

  before_action :enforce_all_values_for_update, only: :update


  after_action :verify_authorized

  def show
    authorize :onboarding

    render json: UserPresenter.new(current_context: pundit_user).personal_details_props
  end

  def update
    authorize :onboarding

    update_params = params_for_update
    error_message = UpdateUser.new(user: Current.user, update_params:).process
    if error_message.blank?
      render json: { success: true }
    else
      render json: { success: false, error_message: Current.user.errors.full_messages.join(". ") }
    end
  end



  private
    def params_for_update
      params.require(:user).permit(:legal_name, :preferred_name, :country_code, :citizenship_country_code)
    end



    def enforce_all_values_for_update
      all_values_present = params_for_update.to_h.values.all?(&:present?)
      unless all_values_present
        render json: { success: false, error_message: "Please input all values" }
      end
    end

    def onboarding_service
      if Current.user.worker?
        OnboardingState::Worker.new(user: Current.user, company: Current.company)
      else
        OnboardingState::Investor.new(user: Current.user, company: Current.company)
      end
    end
end
