# frozen_string_literal: true

class Webhooks::GithubController < ApplicationController
  skip_before_action :force_onboarding, :verify_authenticity_token
  before_action :validate_webhook
  before_action :dismiss_invalid_webhook_events

  def create
    payload = JSON.parse(event_payload)

    head :ok unless IntegrationApi::Github::ALLOWED_WEBHOOK_ACTIONS.include?(payload[:action])

    Rails.logger.info "Webhooks::GithubController.request GitHub ID: #{request.headers["X-GitHub-Delivery"]}"
    Rails.logger.info "Webhooks::GithubController.response payload: #{payload}"

    GithubEventHandlerJob.perform_async(webhook_id, payload)

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
      request.headers["X-Hub-Signature-256"]
    end

    def event
      request.headers["X-GitHub-Event"]
    end

    def webhook_id
      request.headers["X-GitHub-Hook-ID"]
    end

    def dismiss_invalid_webhook_events
      head :ok unless IntegrationApi::Github::ALLOWED_WEBHOOK_EVENTS.include?(event)
    end

    def validate_webhook
      return if Github::WebhookValidator.new(signature_header, event_payload).valid?

      head :bad_request
    end
end
