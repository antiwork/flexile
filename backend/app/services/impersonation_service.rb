# frozen_string_literal: true

class ImpersonationService
  IMPERSONATION_URL_TOKEN_EXPIRY = 5.minutes
  IMPERSONATION_SESSION_EXPIRY = 15.minutes

  class << self
    # Generate a token for impersonation URL (5-minute expiry)
    def generate_impersonation_url_token(user)
      payload = {
        user_id: user.id,
        email: user.email,
        type: "impersonation_url",
        exp: IMPERSONATION_URL_TOKEN_EXPIRY.from_now.to_i,
        iat: Time.current.to_i,
      }

      JWT.encode(payload, jwt_secret, "HS256")
    end

    # Generate a token for active impersonation session (15-minute expiry)
    def generate_impersonation_session_token(user, admin_user)
      payload = {
        user_id: user.id,
        email: user.email,
        admin_user_id: admin_user.id,
        admin_email: admin_user.email,
        type: "impersonation_session",
        exp: IMPERSONATION_SESSION_EXPIRY.from_now.to_i,
        iat: Time.current.to_i,
      }

      JWT.encode(payload, jwt_secret, "HS256")
    end

    # Validate and decode impersonation URL token
    def validate_impersonation_url_token(token)
      return nil unless token

      begin
        decoded_token = JWT.decode(token, jwt_secret, true, { algorithm: "HS256" })
        payload = decoded_token[0]

        # Verify it's an impersonation URL token
        return nil unless payload["type"] == "impersonation_url"

        user = User.find_by(id: payload["user_id"])
        return nil unless user&.email == payload["email"]

        user
      rescue JWT::DecodeError, JWT::ExpiredSignature, ActiveRecord::RecordNotFound
        nil
      end
    end

    # Validate and decode impersonation session token
    def validate_impersonation_session_token(token)
      return nil unless token

      begin
        decoded_token = JWT.decode(token, jwt_secret, true, { algorithm: "HS256" })
        payload = decoded_token[0]

        # Verify it's an impersonation session token
        return nil unless payload["type"] == "impersonation_session"

        user = User.find_by(id: payload["user_id"])
        admin_user = User.find_by(id: payload["admin_user_id"])

        return nil unless user&.email == payload["email"]
        return nil unless admin_user&.email == payload["admin_email"]
        return nil unless admin_user.team_member?

        {
          user: user,
          admin_user: admin_user,
          payload: payload,
        }
      rescue JWT::DecodeError, JWT::ExpiredSignature, ActiveRecord::RecordNotFound
        nil
      end
    end

    # Extract impersonation token from request headers
    def extract_impersonation_token_from_request(request)
      authorization_header = request.headers["x-flexile-impersonation"]
      return nil unless authorization_header&.start_with?("Bearer ")

      authorization_header.split(" ").last
    end

    # Check if request has impersonation token
    def impersonation_token_present_in_request?(request)
      authorization_header = request.headers["x-flexile-impersonation"]
      authorization_header.present? && authorization_header.start_with?("Bearer ")
    end

    # Get impersonated user from request
    def impersonated_user_from_request(request)
      token = extract_impersonation_token_from_request(request)
      return nil unless token

      session_data = validate_impersonation_session_token(token)
      session_data&.dig(:user)
    end

    # Get admin user performing impersonation from request
    def admin_user_from_impersonation_request(request)
      token = extract_impersonation_token_from_request(request)
      return nil unless token

      session_data = validate_impersonation_session_token(token)
      session_data&.dig(:admin_user)
    end

    private
      def jwt_secret
        GlobalConfig.get("JWT_SECRET", Rails.application.secret_key_base)
      end
  end
end
