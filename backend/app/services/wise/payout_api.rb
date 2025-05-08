# frozen_string_literal: true

# https://docs.wise.com/api-docs/api-reference
class Wise::PayoutApi
  include HTTParty
  base_uri WISE_API_URL

  WEBHOOKS_URLS = {
    "transfers#state-change" => Rails.application.routes.url_helpers.transfer_state_change_webhooks_wise_index_url,
    "balances#credit" => Rails.application.routes.url_helpers.balance_credit_webhooks_wise_index_url,
  }

  attr_reader :wise_credential

  def initialize(wise_credential: WiseCredential.flexile_credential)
    @wise_credential = wise_credential
  end

  # Wise::PayoutApi.new(wise_credential:).get_exchange_rate(source_currency: "EUR", target_currency: "USD")
  def get_exchange_rate(source_currency: "USD", target_currency:)
    self.class.get("/v1/rates?source=#{source_currency}&target=#{target_currency}",
                   headers: { "Authorization" => "Bearer #{wise_api_key}" })
  end

  # Wise::PayoutApi.new(wise_credential:).get_profile_details
  def get_profile_details
    self.class.get("/v2/profiles", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
    })
  end

  # Wise::PayoutApi.new(wise_credential:).get_quote(quote_id: "332e0752-1057-4958-aa64-f679890dd123")
  def get_quote(quote_id:)
    self.class.get("/v3/profiles/#{wise_profile_id}/quotes/#{quote_id}",
                   headers: { "Authorization" => "Bearer #{wise_api_key}" })
  end

  # To USD
  # Wise::PayoutApi.new(wise_credential:).create_quote(target_currency: "USD", amount: 123, recipient_id: "12312311")
  #
  # To another currency
  # Wise::PayoutApi.new(wise_credential:).create_quote(target_currency: "GBP", amount: 111, recipient_id: "12312311")
  def create_quote(amount:, target_currency:, recipient_id:)
    body = {
      sourceAmount: nil,
      targetAmount: amount,
      sourceCurrency: "USD",
      targetAccount: recipient_id,
      targetCurrency: target_currency,
      profileId: wise_profile_id,
      preferredPayIn: "BALANCE",
    }

    self.class.post("/v3/profiles/#{wise_profile_id}/quotes", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
      "Content-Type" => "application/json",
    }, body: body.to_json)
  end

  # POST https://api.sandbox.transferwise.tech/v1/accounts
  # Wise::PayoutApi.new(wise_credential:).create_recipient_account
  # {"id":148323208,"business":null,"profile":16421159,"accountHolderName":"Ann Johnson","currency":"GBP","country":"GB","type":"sort_code","details":{"address":{"country":"GB","countryCode":"GB","firstLine":"112 2nd street","postCode":"SW1P 3","city":"London","state":null},"email":"someone@somewhere.com","legalType":"PRIVATE","accountHolderName":null,"accountNumber":"28821822","sortCode":"231470","abartn":null,"accountType":null,"bankgiroNumber":null,"ifscCode":null,"bsbCode":null,"institutionNumber":null,"transitNumber":null,"phoneNumber":null,"bankCode":null,"russiaRegion":null,"routingNumber":null,"branchCode":null,"cpf":null,"cardToken":null,"idType":null,"idNumber":null,"idCountryIso3":null,"idValidFrom":null,"idValidTo":null,"clabe":null,"swiftCode":null,"dateOfBirth":null,"clearingNumber":null,"bankName":null,"branchName":null,"businessNumber":null,"province":null,"city":null,"rut":null,"token":null,"cnpj":null,"payinReference":null,"pspReference":null,"orderId":null,"idDocumentType":null,"idDocumentNumber":null,"targetProfile":null,"targetUserId":null,"taxId":null,"job":null,"nationality":null,"interacAccount":null,"bban":null,"town":null,"postCode":null,"language":null,"billerCode":null,"customerReferenceNumber":null,"prefix":null,"IBAN":null,"iban":null,"BIC":null,"bic":null},"user":5940326,"active":true,"ownedByCustomer":false}
  def create_recipient_account(recipient)
    self.class.post("/v1/accounts", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
      "Content-Type" => "application/json",
    }, body: recipient.merge(profile: wise_profile_id).to_json)
  end

  # POST https://api.sandbox.transferwise.tech/v1/account-requirements?source=USD&target=GBP&sourceAmount=1000
  # Wise::PayoutApi.new(wise_credential:).account_requirements(source: "USD", target: "GBP", source_amount: 1000, details: { address: {}, .. }}, type: nil)
  def account_requirements(source:, target:, source_amount:, details:, type: nil)
    self.class.post("/v1/account-requirements",
                    headers: {
                      "Accept-Language": "en-US,en;q=0.5",
                      "Accept-Minor-Version" => "1",
                      "Content-Type" => "application/json",
                    },
                    query: { source:, target:, sourceAmount: source_amount },
                    body: { type:, details: }.to_json)
  end

  # Wise::PayoutApi.new(wise_credential:).delete_recipient_account
  # DELETE https://api.sandbox.transferwise.tech/v1/accounts/{accountId}
  def delete_recipient_account(recipient_id:)
    self.class.delete("/v1/accounts/#{recipient_id}", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
      "Content-Type" => "application/json",
    })
  end

  # Wise::PayoutApi.new(wise_credential:).get_recipient_account(recipient_id: 148202368)
  def get_recipient_account(recipient_id:)
    self.class.get("/v1/accounts/#{recipient_id}", headers: { "Authorization" => "Bearer #{wise_api_key}" })
  end

  # Wise::PayoutApi.new(wise_credential:).create_transfer(quote_id: "099e335c-f53c-442f-9dab-e3ca96c2844e", recipient_id: 148202368, unique_transaction_id: SecureRandom.uuid)
  def create_transfer(quote_id:, recipient_id:, unique_transaction_id:, reference:)
    self.class.post("/v1/transfers", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
      "Content-Type" => "application/json",
    }, body: {
      targetAccount: recipient_id,
      quoteUuid: quote_id,
      customerTransactionId: unique_transaction_id,
      details: {
        transferPurpose: "verification.transfers.purpose.pay.other",
        sourceOfFunds: "verification.source.of.funds.other",
        reference:,
      },
    }.to_json)
  end

  # Wise::PayoutApi.new(wise_credential:).fund_transfer(transfer_id: "50500593")
  def fund_transfer(transfer_id:)
    self.class.post("/v3/profiles/#{wise_profile_id}/transfers/#{transfer_id}/payments", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
      "Content-Type" => "application/json",
    }, body: {
      type: "BALANCE",
    }.to_json)
  end

  # Wise::PayoutApi.new(wise_credential:).delivery_estimate(transfer_id: "50500593")
  def delivery_estimate(transfer_id:)
    self.class.get("/v1/delivery-estimates/#{transfer_id}", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
    })
  end

  # Wise::PayoutApi.new(wise_credential:).get_balances
  def get_balances
    self.class.get("/v4/profiles/#{wise_profile_id}/balances?types=STANDARD", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
    })
  end

  # Wise::PayoutApi.new(wise_credential:).get_transfer(transfer_id: "50500593")
  def get_transfer(transfer_id:)
    self.class.get("/v1/transfers/#{transfer_id}", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
    })
  end

  # Example usage:
  # Wise::PayoutApi.new(wise_credential:).create_webhook(
  #   trigger: "transfers#state-change",
  #   url: "https://#{ENV['APP_DOMAIN']}/webhooks/wise/transfer_state_change"
  # )
  # Wise::PayoutApi.new(wise_credential:).create_webhook(
  #   trigger: "balances#credit",
  #   url: "https://#{ENV['APP_DOMAIN']}/webhooks/wise/balance_credit"
  # )
  def create_webhook(trigger:, url:)
    self.class.post("/v3/profiles/#{wise_profile_id}/subscriptions", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
      "Content-Type" => "application/json",
    }, body: {
      name: "Flexile - #{trigger}",
      trigger_on: trigger,
      delivery: {
        version: "2.0.0",
        url:,
      },
    }.to_json)
  end

  # Wise::PayoutApi.new(wise_credential:).get_webhooks
  def get_webhooks
    self.class.get("/v3/profiles/#{wise_profile_id}/subscriptions", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
    })
  end

  # Wise::PayoutApi.new(wise_credential:).delete_webhook(webhook_id: <subscription_id from Wise>)
  def delete_webhook(webhook_id:)
    self.class.delete("/v3/profiles/#{wise_profile_id}/subscriptions/#{webhook_id}", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
    })
  end

  # GET /v1/simulation/transfers/{{transferId}}/funds_converted
  def simulate_transfer_funds_converted(transfer_id:)
    self.class.get("/v1/simulation/transfers/#{transfer_id}/funds_converted", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
    })
  end

  # GET /v1/simulation/transfers/{{transferId}}/outgoing_payment_sent
  def simulate_transfer_outgoing_payment_sent(transfer_id:)
    self.class.get("/v1/simulation/transfers/#{transfer_id}/outgoing_payment_sent", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
    })
  end

  # POST /v1/simulation/balance/topup
  def simulate_top_up_balance(balance_id:, currency:, amount:)
    self.class.post("/v1/simulation/balance/topup", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
      "Content-Type" => "application/json",
    }, body: {
      profileId: wise_profile_id,
      balanceId: balance_id.to_s,
      currency:,
      amount:,
    }.to_json)
  end

  # POST /v4/profiles/{{profileId}}/balances
  # Necessary on initial Wise account setup
  def create_usd_balance
    self.class.post("/v4/profiles/#{wise_profile_id}/balances", headers: {
      "Authorization" => "Bearer #{wise_api_key}",
      "Content-Type" => "application/json",
    }, body: {
      currency: "USD",
      type: "STANDARD",
    }.to_json)
  end

  private
    def wise_profile_id
      wise_credential.profile_id
    end

    def wise_api_key
      wise_credential.api_key
    end
end
