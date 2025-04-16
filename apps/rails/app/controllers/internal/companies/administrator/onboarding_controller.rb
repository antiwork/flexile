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

  def bank_account
    authorize Current.company, :show?

    redirect_path = OnboardingState::Company.new(Current.company).redirect_path_from_onboarding_payment_details
    return json_redirect(redirect_path) if redirect_path.present?

    intent = Current.company.fetch_stripe_setup_intent
    render json: {
      client_secret: intent.client_secret,
      setup_intent_status: intent.status,
      stripe_public_key: GlobalConfig.get("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
      name: Current.company.name,
      email: Current.user.email,
      unsigned_document_id: Current.company.documents.unsigned.where.not(docuseal_submission_id: nil).first&.id,
    }
  end

  def added_bank_account
    authorize Current.company, :show?

    render json: { success: Current.company.bank_account.update(status: CompanyStripeAccount::PROCESSING) }
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
end
