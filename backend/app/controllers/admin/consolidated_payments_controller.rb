# frozen_string_literal: true

module Admin
  class ConsolidatedPaymentsController < Admin::ApplicationController
    # See https://administrate-demo.herokuapp.com/customizing_controller_actions
    # for more information

    def refund
      unless requested_resource.refundable?
        return redirect_to after_resource_updated_path(requested_resource),
                           alert: "This consolidated payment is not refundable."
      end

      Stripe::Refund.create({ payment_intent: requested_resource.stripe_payment_intent_id })
      requested_resource.mark_as_refunded!

      redirect_to after_resource_updated_path(requested_resource),
                  notice: "Successfully refunded."
  rescue Stripe::InvalidRequestError => e
    redirect_to after_resource_updated_path(requested_resource),
                alert: "Payment cannot be refunded: #{e.message}"
  rescue Stripe::APIConnectionError, Stripe::APIError => e
    redirect_to after_resource_updated_path(requested_resource),
                alert: "Stripe error while refunding payment: #{e.message}"
    end
  end
end
