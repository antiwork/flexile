# frozen_string_literal: true

require "administrate/field/base"

class StripePaymentIntentIdField < Administrate::Field::Base
  def stripe_payment_dashboard_link
    if Rails.env.production?
      "https://dashboard.stripe.com/payments/#{data}"
    else
      "https://dashboard.stripe.com/test/payments/#{data}"
    end
  end
end
