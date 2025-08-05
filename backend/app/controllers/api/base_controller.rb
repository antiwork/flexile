# frozen_string_literal: true

class Api::BaseController < ActionController::Base
  include JwtAuthenticatable

  protect_from_forgery with: :null_session
  before_action :set_paper_trail_whodunnit
  before_action :verify_api_token

  private
    def set_paper_trail_whodunnit
      PaperTrail.request.whodunnit = Current.user&.id
    end

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

    def e404
      raise ActionController::RoutingError, "Not Found"
    end

    def e401_json
      render json: { success: false, error: "Unauthorized" }, status: :unauthorized
    end
end
