# frozen_string_literal: true

class Webhooks::GithubController < ApplicationController
  skip_before_action :verify_authenticity_token

  def create
    return head :unauthorized unless verify_signature(request.raw_post, request.env["HTTP_X_HUB_SIGNATURE_256"])

    event = JSON.parse(request.raw_post)
    event_type = request.env["HTTP_X_GITHUB_EVENT"]

    Rails.logger.info "GitHub webhook received: #{event_type}"

    Github::EventHandler.new(event, event_type).process!

    head :ok
  rescue JSON::ParserError
    head :bad_request
  rescue StandardError => e
    Rails.logger.error "[GitHub Webhook] #{e.class}: #{e.message}"
    head :internal_server_error
  end

  private
    def verify_signature(payload, signature)
      secret = GlobalConfig.get("GH_WEBHOOK_SECRET")
      return !Rails.env.production? if secret.blank?
      return false if signature.blank?

      expected = "sha256=#{OpenSSL::HMAC.hexdigest('sha256', secret, payload)}"
      ActiveSupport::SecurityUtils.secure_compare(expected, signature)
    end
end
