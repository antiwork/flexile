# frozen_string_literal: true

class JwtService
  JWT_ALGORITHM = "HS256"
  TOKEN_EXPIRY = 1.month
  BEARER_PREFIX = "Bearer "
  AUTH_HEADER = "x-flexile-auth"

  class << self
    def user_from_request(request)
      token = extract_jwt_token_from_request(request)
      return nil unless token

      user_from_token(token)
    end

    def user_from_token(token)
      return nil if token.blank?

      decoded_token = JWT.decode(token, jwt_secret, true, { algorithm: JWT_ALGORITHM })
      payload = decoded_token[0]
      User.find_by(id: payload["user_id"])
    rescue JWT::DecodeError, JWT::ExpiredSignature, ActiveRecord::RecordNotFound
      nil
    end

    def generate_token(user)
      raise ArgumentError, "User cannot be nil" if user.nil?

      payload = {
        user_id: user.id,
        email: user.email,
        exp: TOKEN_EXPIRY.from_now.to_i,
      }

      JWT.encode(payload, jwt_secret, JWT_ALGORITHM)
    end

    def token_present_in_request?(request)
      authorization_header = request.headers[AUTH_HEADER]
      authorization_header.present? && authorization_header.start_with?(BEARER_PREFIX)
    end

    private
      def extract_jwt_token_from_request(request)
        authorization_header = request.headers[AUTH_HEADER]
        return nil unless authorization_header&.start_with?(BEARER_PREFIX)

        authorization_header.delete_prefix(BEARER_PREFIX)
      end

      def jwt_secret
        GlobalConfig.get("JWT_SECRET", Rails.application.secret_key_base)
      end
  end
end
