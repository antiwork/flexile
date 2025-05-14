# frozen_string_literal: true

class Settings::BankAccountsPresenter
  def initialize(user)
    @user = user
  end

  def props
    {
      email: user.email,
      country_code: user.country_code,
      citizenship_country_code: user.citizenship_country_code,
      country: user.display_country,
      state: user.state,
      city: user.city,
      zip_code: user.zip_code,
      street_address: user.street_address,
      billing_entity_name: user.billing_entity_name,
      legal_type: user.business_entity? ? "BUSINESS" : "PRIVATE",
      bank_accounts: user.bank_accounts.alive.order(:id).map(&:edit_props),
      bank_account_currency: user.bank_account&.currency,
      wallet_address: user.wallet&.wallet_address,
    }
  end

  private
    attr_reader :user
end
