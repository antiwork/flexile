# frozen_string_literal: true

module JwtAuthenticatable
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_with_jwt, if: :jwt_token_present?
  end

  private
    def jwt_token_present?
      JwtService.token_present_in_request?(request)
    end

    def authenticate_with_jwt
      user = JwtService.user_from_request(request)
      return render_unauthorized unless user

      Current.user = user
    end

    def generate_jwt_token(user)
      JwtService.generate_token(user)
    end

    def render_unauthorized
      render json: { error: "Unauthorized" }, status: :unauthorized
    end
end
