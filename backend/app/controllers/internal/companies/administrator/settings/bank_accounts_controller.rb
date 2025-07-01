# frozen_string_literal: true

class Internal::Companies::Administrator::Settings::BankAccountsController < Internal::Companies::BaseController
  def show
    authorize Current.company

    intent = Current.company.create_stripe_setup_intent
    render json: {
      client_secret: intent.client_secret,
      bank_account_last4: Current.company.bank_account&.bank_account_last_four,
    }
  end

  def create
    authorize Current.company, :show?
    bank_account = Current.company.bank_accounts.create!(setup_intent_id: params[:setup_intent_id], status: CompanyStripeAccount::PROCESSING)
    bank_account.bank_account_last_four = bank_account.fetch_stripe_bank_account_last_four
    bank_account.save!
  end
end
