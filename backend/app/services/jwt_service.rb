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
