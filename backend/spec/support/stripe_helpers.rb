# frozen_string_literal: true

module StripeHelpers
  BASE_URL = "https://api.stripe.com"

  def setup_company_on_stripe(company, verify_with_microdeposits: false)
    setup_intent =
      Stripe::SetupIntent.create({
        customer: company.stripe_customer_id,
        payment_method_types: ["us_bank_account"],
        payment_method_options: {
          us_bank_account: {
            verification_method: verify_with_microdeposits ? "microdeposits" : "automatic",
            financial_connections: {
              permissions: ["payment_method"],
            },
          },
        },
        payment_method_data: {
          type: "us_bank_account",
          us_bank_account: {
            account_holder_type: "company",
            account_number: "000123456789",
            account_type: "checking",
            routing_number: "110000000",
          },
          billing_details: {
            name: company.name,
            email: company.email,
          },
        },
        expand: ["payment_method"],
      })
    Stripe::SetupIntent.confirm(setup_intent.id, {
      mandate_data: {
        customer_acceptance: {
          type: "offline",
        },
      },
    })

    # Reload to avoid stale association caches; ensure we update the newest alive bank_account
    fresh_account = company.reload.bank_account
    fresh_account.setup_intent_id = setup_intent.id
    fresh_account.status = CompanyStripeAccount::ACTION_REQUIRED if verify_with_microdeposits
    fresh_account.save!

    # Ensure model code that calls Stripe::SetupIntent.retrieve receives an object
    # with an expanded payment_method that has a US bank account with last4 "6789".
    mock_payment_method = Stripe::PaymentMethod.construct_from(
      id: "pm_test_us_bank_account",
      object: "payment_method",
      type: "us_bank_account",
      us_bank_account: {
        account_holder_type: "company",
        account_type: "checking",
        bank_name: "STRIPE TEST BANK",
        fingerprint: "FFDMA0jJDFjDf0aS",
        last4: "6789",
        routing_number: "110000000",
      },
    )

    mock_setup_intent = Stripe::SetupIntent.construct_from(
      id: setup_intent.id,
      object: "setup_intent",
      status: verify_with_microdeposits ? "requires_action" : "succeeded",
      next_action: (verify_with_microdeposits ? {
        type: "verify_with_microdeposits",
        verify_with_microdeposits: {
          arrival_date: Time.now.to_i + 2.days.to_i,
          hosted_verification_url: "https://payments.stripe.com/verification/microdeposits/test_mock",
          microdeposit_type: "descriptor_code",
        },
      } : nil),
      payment_method: mock_payment_method,
    )

    # Be permissive on args to keep tests resilient
    allow(Stripe::SetupIntent).to receive(:retrieve).and_return(mock_setup_intent)
  end
end
