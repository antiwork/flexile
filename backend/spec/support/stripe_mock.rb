# frozen_string_literal: true

# This module configures RSpec to use stripe-mock for testing Stripe API interactions
# instead of making real API calls. This allows tests to run faster and without
# requiring real Stripe API credentials.
#
# stripe-mock is a mock HTTP server that mimics the Stripe API's behavior:
# https://github.com/stripe/stripe-mock
#
# Usage:
# - In CI: Automatically configured when running in GitHub Actions
# - Locally: Set USE_STRIPE_MOCK=true in your environment or .env.test file
#
# The mock server should be running on localhost:12111 (default port)

module StripeMockHelpers
  # Common test data for Stripe objects
  STRIPE_TEST_DATA = {
    payment_methods: {
      us_bank_account: {
        id: "pm_test_us_bank_account",
        object: "payment_method",
        type: "us_bank_account",
        us_bank_account: {
          account_holder_type: "individual",
          account_type: "checking",
          bank_name: "STRIPE TEST BANK",
          fingerprint: "FFDMA0jJDFjDf0aS",
          last4: "6789",
          routing_number: "110000000",
        },
      },
    },
    setup_intents: {
      requires_payment_method: {
        id: "seti_mock_requires_payment_method",
        object: "setup_intent",
        client_secret: "seti_mock_requires_payment_method_secret_test",
        status: "requires_payment_method",
      },
      requires_confirmation: {
        id: "seti_mock_requires_confirmation",
        object: "setup_intent",
        client_secret: "seti_mock_requires_confirmation_secret_test",
        status: "requires_confirmation",
      },
      requires_action: {
        id: "seti_mock_requires_action",
        object: "setup_intent",
        client_secret: "seti_mock_requires_action_secret_test",
        status: "requires_action",
        next_action: {
          type: "verify_with_microdeposits",
          verify_with_microdeposits: {
            arrival_date: Time.now.to_i + 2.days.to_i,
            hosted_verification_url: "https://payments.stripe.com/verification/microdeposits/test_mock",
            microdeposit_type: "descriptor_code",
          },
        },
      },
      succeeded: {
        id: "seti_mock_succeeded",
        object: "setup_intent",
        client_secret: "seti_mock_succeeded_secret_test",
        status: "succeeded",
        payment_method: "pm_test_us_bank_account",
      },
    },
    payment_intents: {
      requires_payment_method: {
        id: "pi_mock_requires_payment_method",
        object: "payment_intent",
        client_secret: "pi_mock_requires_payment_method_secret_test",
        status: "requires_payment_method",
        amount: 1000,
        currency: "usd",
      },
      succeeded: {
        id: "pi_mock_succeeded",
        object: "payment_intent",
        client_secret: "pi_mock_succeeded_secret_test",
        status: "succeeded",
        amount: 1000,
        currency: "usd",
        payment_method: "pm_test_us_bank_account",
      },
    },
    events: {
      setup_intent_succeeded: {
        id: "evt_mock_setup_intent_succeeded",
        object: "event",
        type: "setup_intent.succeeded",
        data: {
          object: {
            id: "seti_mock_succeeded",
            object: "setup_intent",
            status: "succeeded",
            payment_method: "pm_test_us_bank_account",
          },
        },
      },
      payment_intent_succeeded: {
        id: "evt_mock_payment_intent_succeeded",
        object: "event",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_mock_succeeded",
            object: "payment_intent",
            status: "succeeded",
            amount: 1000,
            currency: "usd",
          },
        },
      },
    },
  }.freeze

  # Helper method to create a setup intent via the mock server
  def create_mock_setup_intent(status: "requires_payment_method")
    case status
    when "requires_payment_method"
      Stripe::SetupIntent.construct_from(STRIPE_TEST_DATA[:setup_intents][:requires_payment_method])
    when "requires_confirmation"
      Stripe::SetupIntent.construct_from(STRIPE_TEST_DATA[:setup_intents][:requires_confirmation])
    when "requires_action"
      # Create a fresh copy and set a dynamic arrival_date close to now + 2 days
      base = STRIPE_TEST_DATA[:setup_intents][:requires_action]
      intent_hash = base.dup
      intent_hash[:next_action] = base[:next_action].dup
      intent_hash[:next_action][:verify_with_microdeposits] = base[:next_action][:verify_with_microdeposits].dup
      intent_hash[:next_action][:verify_with_microdeposits][:arrival_date] = Time.now.to_i + 2.days.to_i
      Stripe::SetupIntent.construct_from(intent_hash)
    when "succeeded"
      # Return a setup intent with an expanded payment_method object so model code
      # can access nested fields like `us_bank_account.last4`
      succeeded_intent = STRIPE_TEST_DATA[:setup_intents][:succeeded].dup
      succeeded_intent[:payment_method] = Stripe::PaymentMethod.construct_from(
        STRIPE_TEST_DATA[:payment_methods][:us_bank_account]
      )
      Stripe::SetupIntent.construct_from(succeeded_intent)
    else
      raise ArgumentError, "Unknown setup intent status: #{status}"
    end
  end

  # Helper method to create a payment intent via the mock server
  def create_mock_payment_intent(status: "requires_payment_method", amount: 1000, currency: "usd")
    case status
    when "requires_payment_method"
      intent = STRIPE_TEST_DATA[:payment_intents][:requires_payment_method].dup
      intent[:amount] = amount
      intent[:currency] = currency
      Stripe::PaymentIntent.construct_from(intent)
    when "succeeded"
      intent = STRIPE_TEST_DATA[:payment_intents][:succeeded].dup
      intent[:amount] = amount
      intent[:currency] = currency
      Stripe::PaymentIntent.construct_from(intent)
    else
      raise ArgumentError, "Unknown payment intent status: #{status}"
    end
  end

  # Helper method to create a mock payment method
  def create_mock_payment_method(type: "us_bank_account")
    case type
    when "us_bank_account"
      Stripe::PaymentMethod.construct_from(STRIPE_TEST_DATA[:payment_methods][:us_bank_account])
    else
      raise ArgumentError, "Unknown payment method type: #{type}"
    end
  end

  # Helper method to create a mock Stripe event
  def create_mock_stripe_event(type:)
    case type
    when "setup_intent.succeeded"
      Stripe::Event.construct_from(STRIPE_TEST_DATA[:events][:setup_intent_succeeded])
    when "payment_intent.succeeded"
      Stripe::Event.construct_from(STRIPE_TEST_DATA[:events][:payment_intent_succeeded])
    else
      raise ArgumentError, "Unknown event type: #{type}"
    end
  end

  # Helper to simulate bank account setup for a company
  def setup_company_on_stripe(company, verify_with_microdeposits: false)
    return unless company.bank_account

    setup_intent = if verify_with_microdeposits
      create_mock_setup_intent(status: "requires_action")
    else
      create_mock_setup_intent(status: "succeeded")
    end

    # Ensure subsequent calls to `Stripe::SetupIntent.retrieve` within model code
    # return our constructed mock object for this setup intent. Be permissive on args.
    allow(Stripe::SetupIntent).to receive(:retrieve).and_return(setup_intent)

    company.bank_account.update!(
      setup_intent_id: setup_intent.id,
      status: verify_with_microdeposits ? CompanyStripeAccount::ACTION_REQUIRED : CompanyStripeAccount::READY,
      bank_account_last_four: "1234"
    )

    setup_intent
  end
end

# Configure RSpec to use stripe-mock
RSpec.configure do |config|
  # Include the helpers in all specs
  config.include StripeMockHelpers

  # Configure Stripe to use the mock server before the test suite runs
  config.before(:suite) do
    # Check if we should use stripe-mock
    if ENV["CI"] || ENV["USE_STRIPE_MOCK"]
      # Point Stripe to the mock server
      Stripe.api_base = "http://localhost:12111"

      # Set a dummy API key since we're not making real API calls
      Stripe.api_key = "sk_test_mock"

      puts "🔌 Stripe configured to use stripe-mock server at #{Stripe.api_base}"

      # Verify the mock server is running
      begin
        Stripe::Account.retrieve("acct_default")
        puts "✅ Successfully connected to stripe-mock server"
      rescue => e
        puts "❌ Failed to connect to stripe-mock server: #{e.message}"
        puts "Make sure stripe-mock is running on port 12111"
        puts "You can start it with: docker run --rm -p 12111-12112:12111-12112 stripe/stripe-mock:latest"
        exit(1) if ENV["CI"] # Fail fast in CI if stripe-mock is not available
      end
    end
  end

  # Reset any Stripe-related state between tests
  config.before(:each) do |example|
    # Skip VCR for tests using stripe-mock
    if ENV["CI"] || ENV["USE_STRIPE_MOCK"]
      example.metadata[:vcr] = nil if example.metadata[:vcr]

      # Provide a permissive default stub for SetupIntent retrieval so tests
      # that don't call helper setup still receive an expanded payment method.
      allow(Stripe::SetupIntent).to receive(:retrieve) do |*args|
        id = args.first.is_a?(String) ? args.first : "seti_mock"

        # Build a PaymentMethod with us_bank_account last4 "6789"
        payment_method = Stripe::PaymentMethod.construct_from(
          StripeMockHelpers::STRIPE_TEST_DATA[:payment_methods][:us_bank_account]
        )

        # Construct a default SetupIntent as 'succeeded' (no further action required).
        # Tests that need 'requires_action' should override this via helper methods.
        Stripe::SetupIntent.construct_from(
          id: id,
          object: "setup_intent",
          status: "succeeded",
          payment_method: payment_method
        )
      end
    end
  end

  # Allow specific tests to opt out of using stripe-mock
  config.around(:each, :use_real_stripe) do |example|
    original_api_base = Stripe.api_base
    original_api_key = Stripe.api_key

    # Restore real Stripe configuration for this test
    if ENV["CI"] || ENV["USE_STRIPE_MOCK"]
      Stripe.api_base = "https://api.stripe.com"
      Stripe.api_key = ENV["STRIPE_SECRET_KEY"]
    end

    example.run

    # Restore mock configuration after the test
    if ENV["CI"] || ENV["USE_STRIPE_MOCK"]
      Stripe.api_base = original_api_base
      Stripe.api_key = original_api_key
    end
  end
end
