# frozen_string_literal: true

class Webhooks::StripeController < ApplicationController
  skip_before_action :force_onboarding
  skip_before_action :verify_authenticity_token

  def create
    payload = request.raw_post
    sig_header = request.env["HTTP_STRIPE_SIGNATURE"]
    event = nil
    endpoint_secret = GlobalConfig.get("STRIPE_ENDPOINT_SECRET")

    begin
      event = Stripe::Webhook.construct_event(
        payload, sig_header, endpoint_secret
      )
    rescue JSON::ParserError
      # Invalid payload
      head :bad_request
      return
    rescue Stripe::SignatureVerificationError
      # Invalid signature
      head :bad_request
      return
    end

    Rails.logger.info "Stripe webhook received: #{event.type}"
    Rails.logger.info payload

    Stripe::EventHandler.new(event).process!

    head :ok
  rescue ActiveRecord::RecordNotFound => e
    if Rails.env.production?
      raise e
    else
      # Stripe test environment is used by local development, review apps, and demo app
      # Do not raise an error so that Stripe stops sending events for that particular record
      Rails.logger.error "Stripe webhook received but record not found: #{e.message}"
      head :ok
    end
  end
end
