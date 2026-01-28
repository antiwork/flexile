# frozen_string_literal: true

class JwtService
  class << self
    def user_from_request(request)
      token = extract_jwt_token_from_request(request)
      return nil unless token

      user_from_token(token)
    end

    def user_from_token(token)
      return nil unless token

      begin
        decoded_token = JWT.decode(token, jwt_secret, true, { algorithm: "HS256" })
        payload = decoded_token[0]
        User.find_by(id: payload["user_id"])
      rescue JWT::DecodeError, JWT::ExpiredSignature, ActiveRecord::RecordNotFound
        nil
      end
    end

    def generate_token(user)
      payload = {
        user_id: user.id,
        email: user.email,
        exp: 1.month.from_now.to_i,
      }

      JWT.encode(payload, jwt_secret, "HS256")
    end

    def generate_oauth_state(payload)
      # Short lived state for OAuth flows
      data = payload.merge(exp: 15.minutes.from_now.to_i)
      JWT.encode(data, jwt_secret, "HS256")
    end

    def decode_oauth_state(state)
      return nil unless state

      begin
        decoded = JWT.decode(state, jwt_secret, true, { algorithm: "HS256" })
        decoded[0].with_indifferent_access
      rescue JWT::DecodeError, JWT::ExpiredSignature
        nil
      end
    end

    def token_present_in_request?(request)
      authorization_header = request.headers["x-flexile-auth"]
      authorization_header.present? && authorization_header.start_with?("Bearer ")
    end

    private
      def extract_jwt_token_from_request(request)
        authorization_header = request.headers["x-flexile-auth"]
        return nil unless authorization_header&.start_with?("Bearer ")

        authorization_header.split(" ").last
      end

      def jwt_secret
        GlobalConfig.get("JWT_SECRET", Rails.application.secret_key_base)
      end
  end
end
