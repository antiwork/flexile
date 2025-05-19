# frozen_string_literal: true

RSpec.describe Wise::PayoutApi, :vcr do
  include WiseHelpers

  let!(:wise_credential) { create(:wise_credential) }
  let(:service) { described_class.new }
  let(:create_recipient_account_params) do
    {
      currency: "GBP",
      type: "sort_code",
      details: {
        legalType: "PRIVATE",
        email: "someone@somewhere.com",
        accountHolderName: "someone somewhere",
        sortCode: 231470,
        accountNumber: 28821822,
        address: {
          country: "GB",
          city: "London",
          firstLine: "112 2nd street",
          postCode: "SW1P 3",
        },
      },
    }
  end
  let(:existing_webhook) do
    {
      id: "92d98922-940a-48ee-b6d5-7050ec769d73",
      name: "Flexile - transfers#state-change",
      delivery: { version: "2.0.0", url: Wise::PayoutApi::WEBHOOKS_URLS["transfers#state-change"] },
      trigger_on: "transfers#state-change",
      created_by: { type: "user", id: "6209470" },
      created_at: "2023-03-18T16:01:09Z",
      scope: { domain: "profile", id: wise_credential.profile_id },
      request_headers: nil,
      enabled: true,
    }
  end

  before do
    stub_wise_webhooks_requests(wise_credential.profile_id, existing_webhooks: [existing_webhook])
  end

  describe "#get_exchange_rate" do
    it "makes an API call to fetch the exchange rate" do
      result = service.get_exchange_rate(source_currency: "EUR", target_currency: "USD")

      expect(result.ok?).to eq(true)
      expect(result.first["rate"]).to be_a(Float)
      expect(result.first["source"]).to eq("EUR")
      expect(result.first["target"]).to eq("USD")
      expect(result.first["time"]).to be_present
    end

    it "defaults to USD as the source currency" do
      result = service.get_exchange_rate(target_currency: "GBP")

      expect(result.ok?).to eq(true)
      expect(result.first["source"]).to eq("USD")
    end
  end

  describe "#get_profile_details" do
    it "makes an API call to fetch profile details" do
      result = service.get_profile_details

      expect(result.ok?).to eq(true)
      expect(result.size).to eq(2) # One business account and one personal account
      expect(result.first["id"]).to be_present
      expect(result.first["type"]).to be_present
      expect(result.first["fullName"]).to be_present
      expect(result.second["id"]).to be_present
      expect(result.second["type"]).to be_present
      expect(result.second["fullName"]).to be_present
    end
  end

  describe "#get_quote" do
    let(:quote_id) { "66abad13-6a59-4985-8af5-5d738317628a" }
    subject(:response) { service.get_quote(quote_id:) }

    it "gets the quote details" do
      expect(response.ok?).to eq(true)
      expect(response["id"]).to eq(quote_id)
      expect(response["preferredPayIn"]).to eq("BALANCE")
      expect(response["targetAmount"]).to be_present

      payment_option = response["paymentOptions"].find { |opt| opt["payIn"] == "BALANCE" }
      expect(payment_option.dig("fee", "total")).to be_present
      expect(payment_option["sourceAmount"]).to be_present
    end
  end

  describe "#create_quote" do
    subject(:response) { service.create_quote(target_currency:, amount: 112, recipient_id: "148563324") }

    context "when the target currency is USD" do
      let(:target_currency) { "USD" }

      it "makes an API call to generate a transfer quote" do
        expect(response.ok?).to eq(true)
        expect(response["id"]).to be_present
        expect(response["preferredPayIn"]).to eq("BALANCE")
        expect(response["targetAmount"]).to eq(112.0)

        payment_option = response["paymentOptions"].find { |opt| opt["payIn"] == "BALANCE" }
        expect(payment_option["targetAmount"]).to eq(112.0)
        expect(payment_option["sourceAmount"]).to be > 112.0 # Flexile pays transfer fees
      end
    end

    context "when the target currency is not USD" do
      let(:target_currency) { "GBP" }

      it "makes an API call to generate a transfer quote" do
        expect(response.ok?).to eq(true)
        expect(response["id"]).to be_present
        expect(response["preferredPayIn"]).to eq("BALANCE")
        expect(response["targetAmount"]).to eq(112.0)

        payment_option = response["paymentOptions"].find { |opt| opt["payIn"] == "BALANCE" }
        expect(payment_option["targetAmount"]).to eq(112.0)
      end
    end
  end

  describe "#create_recipient_account" do
    it "makes an API call to create a recipient in Wise" do
      result = service.create_recipient_account(create_recipient_account_params)

      expect(result.ok?).to eq(true)
      expect(result["id"]).to be_present
      expect(result["currency"]).to eq("GBP")
      expect(result["profile"]).to eq(WISE_PROFILE_ID.to_i)
      expect(result["business"]).to eq(WISE_PROFILE_ID.to_i)
      expect(result["details"]["accountNumber"].last(4)).to eq("1822")
    end
  end

  describe "#delete_recipient_account" do
    it "makes an API call to delete recipient" do
      result = service.delete_recipient_account(recipient_id: "148565647")

      expect(result.ok?).to eq(true)
    end
  end

  describe "#get_recipient_account" do
    it "makes an API call to fetch recipient details" do
      result = service.get_recipient_account(recipient_id: "148563324")

      expect(result.ok?).to eq(true)
      expect(result["id"]).to be_present
      expect(result["business"]).to be_present
      expect(result["profile"]).to be_present
      expect(result["accountHolderName"]).to be_present
      expect(result["currency"]).to be_present
      expect(result["country"]).to be_present
      expect(result["type"]).to be_present
      expect(result["details"]).to be_present
      expect(result["user"]).to be_present
      expect(result["active"]).to be_present
      expect(result["ownedByCustomer"]).to eq(false)
    end
  end

  describe "#create_transfer" do
    it "makes an API call to create a transfer in Wise" do
      recipient_id = service.create_recipient_account(create_recipient_account_params)["id"]
      quote_id = service.create_quote(target_currency: "GBP", amount: 112, recipient_id:)["id"]
      unique_transaction_id = SecureRandom.uuid
      result = service.create_transfer(quote_id:, recipient_id:, unique_transaction_id:, reference: "DIV")

      expect(result.ok?).to eq(true)
      expect(result["id"]).to be_present
    end
  end

  describe "#fund_transfer" do
    it "makes an API call to create a transfer in Wise" do
      recipient_id = service.create_recipient_account(create_recipient_account_params)["id"]
      quote_id = service.create_quote(target_currency: "GBP", amount: 112, recipient_id:)["id"]
      unique_transaction_id = SecureRandom.uuid
      transfer_id = service.create_transfer(quote_id:, recipient_id:, unique_transaction_id:, reference: "PMT")["id"]
      result = service.fund_transfer(transfer_id:)

      expect(result.created?).to eq(true)
      expect(result["status"]).to eq("COMPLETED")
    end
  end

  describe "#get_balances" do
    it "fetches the balance details for the Wise profile" do
      result = service.get_balances

      expect(result.ok?).to eq(true)
      usd_balance_details = result.find do |balance|
        balance["currency"] == "USD"
      end

      expect(usd_balance_details["id"]).to be_present
      expect(usd_balance_details["type"]).to eq("STANDARD")
      expect(usd_balance_details["currency"]).to eq("USD")
      expect(usd_balance_details["amount"]["value"]).to be_kind_of(Numeric)
      expect(usd_balance_details["amount"]["currency"]).to eq("USD")
      expect(usd_balance_details["reservedAmount"]["value"]).to be_kind_of(Numeric)
      expect(usd_balance_details["reservedAmount"]["currency"]).to eq("USD")
    end
  end

  describe "#get_webhooks" do
    it "fetches existing webhooks for the Wise profile" do
      result = service.get_webhooks
      response = result.parsed_response
      expect(result.ok?).to eq(true)
      expect(response.size).to eq(1)
      expect(response.first.deep_symbolize_keys).to eq(existing_webhook)
    end
  end

  describe "#create_webhook" do
    it "creates a webhook for the Wise profile, or returns the existing profile if it exists" do
      result = service.create_webhook(trigger: "balances#credit", url: Wise::PayoutApi::WEBHOOKS_URLS["balances#credit"])
      expect(result.created?).to eq(true)
      expect(result.parsed_response["name"]).to eq("Flexile - balances#credit")
    end
  end

  describe "#delete_webhook" do
    it "deletes the webhook" do
      result = service.delete_webhook(webhook_id: existing_webhook["id"])
      expect(result.ok?)
    end
  end

  describe "#account_requirements" do
    it "fetches the account requirements for recipient creation" do
      result = service.account_requirements(source: "USD", target: "GBP", source_amount: 10_000, details: {})
      response = result.parsed_response
      expect(result.ok?).to eq(true)
      expect(response).to be_present
      expect(response.first["type"]).to eq("sort_code")
      expect(response.first["title"]).to eq("Local bank account")
    end
  end

  describe "#simulate_top_up_balance" do
    it "simulates a top-up of the balance" do
      result = service.simulate_top_up_balance(balance_id: 97347, currency: "USD", amount: 1_000)
      expect(result["state"]).to eq("COMPLETED")
    end
  end
end
