# frozen_string_literal: true

class RealStripeService
  def retrieve_setup_intent(params = {})
    Stripe::SetupIntent.retrieve(params)
  end

  def create_payment_intent(params = {})
    Stripe::PaymentIntent.create(params)
  end

  def create_customer(params = {})
    Stripe::Customer.create(params)
  end

  def create_setup_intent(params = {})
    Stripe::SetupIntent.create(params)
  end
end
