# frozen_string_literal: true

class MockStripeService
  def retrieve_setup_intent(params = {})
    Stripe::SetupIntent.construct_from({
      id: params[:id],
      status: "succeeded",
      payment_method: {
        id: "pm_test_fake_123456789",
        us_bank_account: {
          last4: "4242",
        },
      },
    })

    # If this needs to return different values,
    # we could use special setup intent ids to return different values.
  end

  def create_payment_intent(params = {})
    Stripe::PaymentIntent.construct_from({
      # Only using needed fields.
      id: "pi_test_fake_123456789",
      latest_charge: {
        id: "ch_test_fake_123456789",
        amount: params[:amount] || 1000,
      },
    })
  end

  def create_customer(params = {})
    Stripe::Customer.construct_from({
      id: "cus_test_fake_123456789",
    })
  end

  def create_setup_intent(params = {})
    Stripe::SetupIntent.construct_from({
      id: "seti_test_fake_123456789",
      client_secret: "seti_test_fake_123456789_secret_fake123456789",
    })
  end
end
