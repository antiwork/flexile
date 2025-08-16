# frozen_string_literal: true

# This module provides comprehensive mocking for Wise API interactions in tests.
# It uses WebMock to stub HTTP requests to the Wise API and provides helper methods
# to generate realistic mock responses for different scenarios.
#
# Usage:
#   include WiseMocks
#
#   # In a test:
#   setup_wise_mocks
#   # Or for specific scenarios:
#   setup_wise_mocks(balance: 5000)
#
# The mock will use https://api.sandbox.transferwise.tech as the base URL.

require "webmock/rspec"

module WiseMocks
  # Base URL for Wise API sandbox
  WISE_API_URL = "https://api.sandbox.transferwise.tech"

  # Common test data for Wise objects
  WISE_TEST_DATA = {
    profile: {
      id: "16421159",
      type: "personal",
      firstName: "Test",
      lastName: "User",
      dateOfBirth: "1990-01-01",
      phoneNumber: "+15555555555",
      avatar: nil,
      occupation: nil,
      primaryAddress: {
        country: "US",
        countryCode: "US",
        firstLine: "123 Test St",
        postCode: "12345",
        city: "San Francisco",
        state: "CA",
      },
    },
    balance: {
      id: 12345,
      profileId: 16421159,
      currency: "USD",
      type: "STANDARD",
      amount: {
        value: 1000.00,
        currency: "USD",
      },
      reservedAmount: {
        value: 0,
        currency: "USD",
      },
      bankDetails: {
        accountHolderName: "Test User",
        accountNumber: "0000000000",
        sortCode: "000000",
        bankName: "TEST BANK",
      },
    },
    recipient: {
      id: 148563324,
      currency: "USD",
      country: "US",
      type: "sort_code",
      accountHolderName: "Test Recipient",
      business: nil,
      profile: 16421159,
      active: true,
      ownedByCustomer: true,
      details: {
        address: {
          country: "US",
          countryCode: "US",
          firstLine: "456 Test Ave",
          postCode: "54321",
          city: "New York",
          state: "NY",
        },
        email: "sharang@example.com",
        legalType: "PRIVATE",
        accountNumber: "1234567890",
        sortCode: "111222",
        routingNumber: "021000021",
        accountType: "CHECKING",
        abartn: nil,
        BIC: nil,
        IBAN: nil,
        bankCode: nil,
        bankName: nil,
        bankgiroNumber: nil,
        bban: nil,
        bic: nil,
        billerCode: nil,
        branchCode: nil,
        branchName: nil,
        bsbCode: nil,
        businessNumber: nil,
        cardToken: nil,
        city: nil,
        clabe: nil,
        clearingNumber: nil,
        cnpj: nil,
        cpf: nil,
        customerReferenceNumber: nil,
        dateOfBirth: nil,
        iban: nil,
        idCountryIso3: nil,
        idDocumentNumber: nil,
        idDocumentType: nil,
        idNumber: nil,
        idType: nil,
        idValidFrom: nil,
        idValidTo: nil,
        ifscCode: nil,
        institutionNumber: nil,
        interacAccount: nil,
        job: nil,
        language: nil,
        nationality: nil,
        orderId: nil,
        payinReference: nil,
        phoneNumber: nil,
        postCode: nil,
        prefix: nil,
        province: nil,
        pspReference: nil,
        russiaRegion: nil,
        rut: nil,
        swiftCode: nil,
        targetProfile: nil,
        targetUserId: nil,
        taxId: nil,
        token: nil,
        town: nil,
        transitNumber: nil,
      },
    },
    quote: {
      id: "099e335c-f53c-442f-9dab-e3ca96c2844e",
      sourceCurrency: "USD",
      targetCurrency: "USD",
      sourceAmount: 100.00,
      targetAmount: 100.00,
      rate: 1.0,
      createdTime: Time.now.iso8601,
      user: 5940326,
      profile: 16421159,
      rateType: "FIXED",
      rateExpirationTime: (Time.current + 1.day).iso8601,
      payOut: "BANK_TRANSFER",
      status: "PENDING",
    },
    transfer: {
      id: 50500593,
      user: 5940326,
      targetAccount: 148563324,
      sourceAccount: nil,
      quote: "099e335c-f53c-442f-9dab-e3ca96c2844e",
      status: "incoming_payment_waiting",
      reference: "Invoice Payment",
      rate: 1.0,
      created: Time.now.iso8601,
      business: nil,
      transferRequest: nil,
      details: {
        reference: "Invoice Payment",
      },
      hasActiveIssues: false,
      sourceCurrency: "USD",
      sourceValue: 100.00,
      targetCurrency: "USD",
      targetValue: 100.00,
      customerTransactionId: "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
    },
    delivery_estimate: {
      estimatedDeliveryDate: (Time.current + 2.days).iso8601,
    },
    exchange_rate: [
      {
        rate: 1.0,
        source: "USD",
        target: "USD",
        time: Time.now.iso8601,
      }
    ],
    webhook: {
      id: "webhook-id-123456",
      name: "Flexile - transfers#state-change",
      trigger_on: "transfers#state-change",
      delivery: {
        version: "2.0.0",
        url: "https://example.com/webhooks/wise/transfer_state_change",
      },
    },
    account_requirements: [
      {
        type: "sort_code",
        title: "Account number and sort code",
        fields: [
          {
            name: "Account number",
            group: [],
            required: true,
            displayFormat: "^[0-9]{8}$",
            example: "12345678",
            minLength: 8,
            maxLength: 8,
            validationRegexp: "^[0-9]{8}$",
            validationAsync: nil,
            valuesAllowed: nil,
          },
          {
            name: "Sort code",
            group: [],
            required: true,
            displayFormat: "^[0-9]{6}$",
            example: "112233",
            minLength: 6,
            maxLength: 6,
            validationRegexp: "^[0-9]{6}$",
            validationAsync: nil,
            valuesAllowed: nil,
          }
        ],
      }
    ],
  }.freeze

  # Sets up all Wise API mocks with customizable options
  # @param balance [Float] Balance amount to use in mocks
  # @param currency [String] Currency to use in mocks
  # @param transfer_status [String] Status to use for transfer mocks
  # @param error [Boolean] Whether to simulate error responses
  def setup_wise_mocks(balance: 1000.00, currency: "USD", transfer_status: "incoming_payment_waiting", error: false)
    if error
      setup_wise_error_mocks
    else
      setup_wise_success_mocks(balance: balance, currency: currency, transfer_status: transfer_status)
    end
  end

  # Sets up mocks for successful API responses
  def setup_wise_success_mocks(balance: 1000.00, currency: "USD", transfer_status: "incoming_payment_waiting")
    # Prepare customized data based on parameters
    balance_data = WISE_TEST_DATA[:balance].deep_dup
    balance_data[:currency] = currency
    balance_data[:amount][:value] = balance
    balance_data[:amount][:currency] = currency

    # Mock exchange rate endpoint
    stub_request(:get, %r{#{WISE_API_URL}/v1/rates}o)
      .to_return(
        status: 200,
        body: WISE_TEST_DATA[:exchange_rate].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock profile details endpoint
    stub_request(:get, "#{WISE_API_URL}/v2/profiles")
      .to_return(
        status: 200,
        body: [WISE_TEST_DATA[:profile]].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock get quote endpoint
    stub_request(:get, %r{#{WISE_API_URL}/v3/profiles/.+/quotes/.+}o)
      .to_return(
        status: 200,
        body: WISE_TEST_DATA[:quote].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock create quote endpoint
    stub_request(:post, %r{#{WISE_API_URL}/v3/profiles/.+/quotes}o)
      .to_return(
        status: 200,
        body: WISE_TEST_DATA[:quote].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock create recipient account endpoint
    stub_request(:post, "#{WISE_API_URL}/v1/accounts")
      .to_return(
        status: 201,
        body: WISE_TEST_DATA[:recipient].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock get recipient account endpoint
    stub_request(:get, %r{#{WISE_API_URL}/v1/accounts/\d+}o)
      .to_return(
        status: 200,
        body: WISE_TEST_DATA[:recipient].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock delete recipient account endpoint
    stub_request(:delete, %r{#{WISE_API_URL}/v1/accounts/\d+}o)
      .to_return(
        status: 200,
        body: "".to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock account requirements endpoint
    stub_request(:post, "#{WISE_API_URL}/v1/account-requirements")
      .to_return(
        status: 200,
        body: WISE_TEST_DATA[:account_requirements].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock create transfer endpoint
    transfer_data = WISE_TEST_DATA[:transfer].deep_dup
    transfer_data[:status] = transfer_status
    stub_request(:post, "#{WISE_API_URL}/v1/transfers")
      .to_return(
        status: 200,
        body: transfer_data.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock fund transfer endpoint
    stub_request(:post, %r{#{WISE_API_URL}/v3/profiles/.+/transfers/.+/payments}o)
      .to_return(
        status: 200,
        body: { type: "BALANCE" }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock get transfer endpoint
    stub_request(:get, %r{#{WISE_API_URL}/v1/transfers/\d+}o)
      .to_return(
        status: 200,
        body: transfer_data.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock delivery estimate endpoint
    stub_request(:get, %r{#{WISE_API_URL}/v1/delivery-estimates/\d+}o)
      .to_return(
        status: 200,
        body: WISE_TEST_DATA[:delivery_estimate].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock get balances endpoint
    stub_request(:get, %r{#{WISE_API_URL}/v4/profiles/.+/balances}o)
      .to_return(
        status: 200,
        body: [balance_data].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock create webhook endpoint
    stub_request(:post, %r{#{WISE_API_URL}/v3/profiles/.+/subscriptions}o)
      .to_return(
        status: 200,
        body: WISE_TEST_DATA[:webhook].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock get webhooks endpoint
    stub_request(:get, %r{#{WISE_API_URL}/v3/profiles/.+/subscriptions}o)
      .to_return(
        status: 200,
        body: [WISE_TEST_DATA[:webhook]].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock delete webhook endpoint
    stub_request(:delete, %r{#{WISE_API_URL}/v3/profiles/.+/subscriptions/.+}o)
      .to_return(
        status: 200,
        body: "".to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock simulation endpoints
    stub_request(:get, %r{#{WISE_API_URL}/v1/simulation/transfers/.+/funds_converted}o)
      .to_return(
        status: 200,
        body: { success: true }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    stub_request(:get, %r{#{WISE_API_URL}/v1/simulation/transfers/.+/outgoing_payment_sent}o)
      .to_return(
        status: 200,
        body: { success: true }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    stub_request(:post, "#{WISE_API_URL}/v1/simulation/balance/topup")
      .to_return(
        status: 200,
        body: { success: true }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    # Mock create USD balance endpoint
    stub_request(:post, %r{#{WISE_API_URL}/v4/profiles/.+/balances}o)
      .to_return(
        status: 200,
        body: balance_data.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  # Sets up mocks for error API responses
  def setup_wise_error_mocks
    # Mock common error responses
    error_response = {
      errors: [
        {
          code: "GENERAL_ERROR",
          message: "An unexpected error occurred",
        }
      ],
    }

    # Mock all endpoints to return errors
    stub_request(:any, /#{WISE_API_URL}/o)
      .to_return(
        status: 500,
        body: error_response.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  # Simulates specific error scenarios
  # @param scenario [Symbol] The error scenario to simulate
  def simulate_wise_error(scenario)
    case scenario
    when :insufficient_funds
      error_response = {
        errors: [
          {
            code: "BALANCE_FUNDS_REQUIRED",
            message: "Not enough funds in the account",
          }
        ],
      }

      # Mock fund transfer to fail with insufficient funds
      stub_request(:post, %r{#{WISE_API_URL}/v3/profiles/.+/transfers/.+/payments}o)
        .to_return(
          status: 422,
          body: error_response.to_json,
          headers: { "Content-Type" => "application/json" }
        )

    when :recipient_validation_failed
      error_response = {
        errors: [
          {
            code: "VALIDATION_ERROR",
            message: "Recipient details are invalid",
            fields: [
              {
                name: "accountNumber",
                message: "Account number is invalid",
              }
            ],
          }
        ],
      }

      # Mock recipient creation to fail with validation error
      stub_request(:post, "#{WISE_API_URL}/v1/accounts")
        .to_return(
          status: 422,
          body: error_response.to_json,
          headers: { "Content-Type" => "application/json" }
        )

    when :rate_limit_exceeded
      # Mock rate limit error
      stub_request(:any, /#{WISE_API_URL}/o)
        .to_return(
          status: 429,
          body: { error: "Too many requests" }.to_json,
          headers: {
            "Content-Type" => "application/json",
            "X-RateLimit-Limit" => "60",
            "X-RateLimit-Remaining" => "0",
            "X-RateLimit-Reset" => (Time.current + 60).to_i.to_s,
          }
        )
    end
  end

  # Helper method to simulate a successful transfer
  # @param transfer_id [Integer] The ID of the transfer to update
  # @param status [String] The new status of the transfer
  def simulate_transfer_status_change(transfer_id, status)
    transfer_data = WISE_TEST_DATA[:transfer].deep_dup
    transfer_data[:id] = transfer_id
    transfer_data[:status] = status

    stub_request(:get, "#{WISE_API_URL}/v1/transfers/#{transfer_id}")
      .to_return(
        status: 200,
        body: transfer_data.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  # Helper method to simulate a balance update
  # @param balance [Float] The new balance amount
  # @param currency [String] The currency of the balance
  def simulate_balance_update(balance, currency = "USD")
    balance_data = WISE_TEST_DATA[:balance].deep_dup
    balance_data[:currency] = currency
    balance_data[:amount][:value] = balance
    balance_data[:amount][:currency] = currency

    stub_request(:get, %r{#{WISE_API_URL}/v4/profiles/.+/balances}o)
      .to_return(
        status: 200,
        body: [balance_data].to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  # Helper method to generate a webhook event payload
  # @param event_type [String] The type of event
  # @param data [Hash] The event data
  # @return [Hash] The webhook event payload
  def generate_wise_webhook_event(event_type, data)
    {
      data: data,
      subscription_id: "subscription-id-123456",
      event_type: event_type,
      schema_version: "2.0.0",
      sent_at: Time.now.iso8601,
    }
  end
end

# Configure RSpec to use Wise mocks
RSpec.configure do |config|
  # Include the helpers in all specs
  config.include WiseMocks

  # Set up Wise mocks for tests tagged with :wise_mock
  config.before(:each, :wise_mock) do
    setup_wise_mocks
  end

  # Clean up after each test
  config.after(:each, :wise_mock) do
    WebMock.reset!
  end
end
