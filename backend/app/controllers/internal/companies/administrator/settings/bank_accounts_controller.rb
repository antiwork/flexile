# frozen_string_literal: true

class Internal::Companies::Administrator::Settings::BankAccountsController < Internal::Companies::BaseController
  def show
    authorize Current.company

    intent = Current.company.fetch_stripe_setup_intent
    render json: {
      client_secret: intent.client_secret,
      setup_intent_status: intent.status,
    }
  end

  def create
    authorize Current.company, :show?

    render json: { success: Current.company.bank_account.update(status: CompanyStripeAccount::PROCESSING) }
  end
end
