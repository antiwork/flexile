# frozen_string_literal: true

module JwtAuthenticatable
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_with_jwt, if: :jwt_token_present?
  end

  private
    def jwt_token_present?
      authorization_header.present? && authorization_header.start_with?("Bearer ")
    end

    def authenticate_with_jwt
      token = extract_jwt_token
      return render_unauthorized unless token

      begin
        decoded_token = JWT.decode(token, jwt_secret, true, { algorithm: "HS256" })
        payload = decoded_token[0]

        user = User.find_by(id: payload["user_id"])
        return render_unauthorized unless user

        Current.user = user
      rescue JWT::DecodeError, JWT::ExpiredSignature, ActiveRecord::RecordNotFound
        render_unauthorized
      end
    end

    def extract_jwt_token
      authorization_header&.split(" ")&.last
    end

    def authorization_header
      request.headers["x-flexile-auth"]
    end

    def generate_jwt_token(user)
      payload = {
        user_id: user.id,
        email: user.email,
        exp: 1.month.from_now.to_i,
      }

      JWT.encode(payload, jwt_secret, "HS256")
    end

    def jwt_secret
      GlobalConfig.get("JWT_SECRET", Rails.application.secret_key_base)
    end

    def render_unauthorized
      render json: { error: "Unauthorized" }, status: :unauthorized
    end
end
