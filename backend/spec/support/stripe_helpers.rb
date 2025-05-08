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

    company.bank_account.setup_intent_id = setup_intent.id
    company.bank_account.status = CompanyStripeAccount::ACTION_REQUIRED if verify_with_microdeposits
    company.bank_account.save!
  end
end
