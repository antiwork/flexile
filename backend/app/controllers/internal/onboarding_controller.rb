# frozen_string_literal: true

class Internal::OnboardingController < Internal::BaseController
  skip_before_action :force_onboarding

  before_action :authenticate_user_json!

  before_action :enforce_all_values_for_update, only: :update
  before_action :skip_step, if: -> { Current.user.sanctioned_country_resident? }, only: [:save_bank_account]

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

  def save_bank_account
    authorize :onboarding

    recipient_service = Recipient::CreateService.new(
      user: Current.user,
      params: params_for_save_bank_account.to_h,
      replace_recipient_id: params[:replace_recipient_id].presence
    )
    render json: recipient_service.process
  end

  private
    def params_for_update
      params.require(:user).permit(:legal_name, :preferred_name, :country_code, :citizenship_country_code)
    end

    def params_for_save_bank_account
      params.require(:recipient).permit(:currency, :type, details: {})
    end

    def enforce_all_values_for_update
      all_values_present = params_for_update.to_h.values.all?(&:present?)
      unless all_values_present
        render json: { success: false, error_message: "Please input all values" }
      end
    end

    def skip_step
      json_redirect(onboarding_service.redirect_path || onboarding_service.after_complete_onboarding_path)
    end

    def onboarding_service
      if Current.user.worker?
        OnboardingState::Worker.new(user: Current.user, company: Current.company)
      else
        OnboardingState::Investor.new(user: Current.user, company: Current.company)
      end
    end
end
