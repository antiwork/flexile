# frozen_string_literal: true

class Internal::Companies::Administrator::OnboardingController < Internal::Companies::BaseController
  skip_before_action :force_onboarding
  skip_before_action :ensure_company_is_present!, only: [:details, :update]

  before_action :enforce_all_values_for_update, only: :update

  def details
    authorize Current.company, :show?, policy_class: CompanyPolicy

    redirect_path = OnboardingState::Company.new(Current.company).redirect_path_from_onboarding_details
    return json_redirect(redirect_path) if redirect_path.present?

    administrator = Current.company_administrator || Current.user.company_administrators.build(company: Company.build(email: Current.user.email, external_id: "_"))
    render json: CompanyAdministratorPresenter.new(administrator).company_onboarding_props
  end

  def update
    if Current.user.initial_onboarding?
      company = Company.create!(email: Current.user.email, country_code: SignUpCompany::US_COUNTRY_CODE, default_currency: SignUpCompany::DEFAULT_CURRENCY)
      Current.user.company_administrators.create!(company:)
      subscribe_administrator_to_newsletter
      reset_current
    end
    authorize Current.company, :update?

    administrator = Current.user
    ActiveRecord::Base.transaction do
      Current.company.update!(company_params)
      administrator.update!(legal_name: params[:legal_name])
    end
  rescue ActiveRecord::RecordInvalid => e
    render json: {
      success: false,
      error_message: e.record.errors.full_messages.to_sentence,
    }
  else
    render json: { success: true }
  end

  private
    def company_params
      params.require(:company).permit(:name, :street_address, :city, :state, :zip_code)
    end

    def enforce_all_values_for_update
      all_values_present = company_params.to_h.values.all?(&:present?)
      return if all_values_present && params[:legal_name].present?

      render json: { success: false, error_message: "Please input all values" }
    end

    def subscribe_administrator_to_newsletter
      return unless ENV["RESEND_AUDIENCE_ID"].present?

      begin
        Resend::Contacts.create(
          audience_id: ENV["RESEND_AUDIENCE_ID"],
          email: Current.user.email,
          unsubscribed: false
        )
      rescue => e
        Rails.logger.error("Failed to subscribe user to Resend: #{e.message}")
        Bugsnag.notify(e) do |event|
          event.add_metadata(:resend, {
            action: "subscribe_administrator_to_newsletter",
            email: Current.user.email,
            audience_id: ENV["RESEND_AUDIENCE_ID"],
          })
        end
      end
    end
end
