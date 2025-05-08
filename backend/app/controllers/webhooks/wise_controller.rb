# frozen_string_literal: true

class Webhooks::WiseController < ApplicationController
  skip_before_action :force_onboarding
  skip_before_action :verify_authenticity_token
  before_action :validate_webhook
  before_action :handle_test_notification

  def transfer_state_change
    WiseTransferUpdateJob.perform_async(request.request_parameters.to_hash)
    render json: { success: true }
  end

  def balance_credit
    WiseBalanceWebhookJob.perform_async(request.request_parameters.to_hash)
    render json: { success: true }
  end

  private
    def validate_webhook
      return if Wise::WebhookValidator.new(request.headers["X-Signature-SHA256"], request.raw_post).valid?

      render json: { success: false }, status: :bad_request
    end

    def handle_test_notification
      if request.headers["X-Test-Notification"] == "true"
        render json: { success: true, message: "Good check!" }
      end
    end
end
