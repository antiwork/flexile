# frozen_string_literal: true

class Internal::OnboardingController < Internal::BaseController
  skip_before_action :force_onboarding

  before_action :authenticate_user_json!

  before_action :redirect_if_onboarding_complete, only: [:bank_account]
  before_action :enforce_all_values_for_update, only: :update
  before_action :ensure_required_data_present, only: :bank_account
  before_action :skip_step, if: -> { Current.user.sanctioned_country_resident? }, only: [:bank_account, :save_bank_account]

  after_action :verify_authorized

  def show
    authorize :onboarding

    render json: UserPresenter.new(current_context: pundit_user).personal_details_props
  end

  def update
    authorize :onboarding

    update_params = params_for_update
    update_params[:inviting_company] = true if Current.user.initial_onboarding?
    error_message = UpdateUser.new(user: Current.user, update_params:).process
    if error_message.blank?
      render json: { success: true }
    else
      render json: { success: false, error_message: Current.user.errors.full_messages.join(". ") }
    end
  end

  def bank_account
    authorize :onboarding

    return json_redirect("/dashboard") if Current.user.bank_account.present?

    render json: UserPresenter.new(current_context: pundit_user).billing_details_props
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
    def ensure_required_data_present
      return if onboarding_service.has_personal_details?

      json_redirect(onboarding_service.redirect_path)
    end

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

    def redirect_if_onboarding_complete
      json_redirect(onboarding_service.after_complete_onboarding_path) if onboarding_service.complete?
    end

    def skip_step
      json_redirect(onboarding_service.redirect_path || onboarding_service.after_complete_onboarding_path)
    end

    def onboarding_service
      if Current.user.worker?
        OnboardingState::Worker.new(user: Current.user, company: Current.company)
      elsif Current.user.inviting_company?
        OnboardingState::WorkerWithoutCompany.new(user: Current.user, company: nil)
      else
        OnboardingState::Investor.new(user: Current.user, company: Current.company)
      end
    end
end
