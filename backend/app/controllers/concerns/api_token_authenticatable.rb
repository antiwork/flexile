# frozen_string_literal: true

module ApiTokenAuthenticatable
  extend ActiveSupport::Concern

  included do
    before_action :verify_api_token
  end

  private
    def verify_api_token
      token = params[:token]

      if token.blank?
        return render json: { error: "Token is required" }, status: :bad_request
      end

      unless valid_api_token?(token)
        render json: { error: "Invalid token" }, status: :unauthorized
      end
    end

    def valid_api_token?(token)
      expected_token = GlobalConfig.get("API_SECRET_TOKEN", Rails.application.secret_key_base)
      ActiveSupport::SecurityUtils.secure_compare(token, expected_token)
    end
end
