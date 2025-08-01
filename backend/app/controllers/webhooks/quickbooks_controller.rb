# frozen_string_literal: true

class Webhooks::QuickbooksController < ApplicationController
  skip_before_action :verify_authenticity_token
  before_action :validate_webhook

  def create
    event = JSON.parse(event_payload)
    Rails.logger.info "Webhooks::QuickbooksController.request Intuit TID: #{request.headers["intuit-t-id"]}"
    Rails.logger.info "Webhooks::QuickbooksController.response payload: #{event}"

    QuickbooksEventHandlerJob.perform_async(event)

    head :ok
  rescue JSON::ParserError
    # Invalid payload
    head :bad_request
  end

  private
    def event_payload
      request.raw_post
    end

    def signature_header
      request.headers["intuit-signature"]
    end

    def validate_webhook
      return if Quickbooks::WebhookValidator.new(signature_header, event_payload).valid?

      head :bad_request
    end
end
