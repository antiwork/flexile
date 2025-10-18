# frozen_string_literal: true

module UserDataSerialization
  extend ActiveSupport::Concern

  private
    def user_data(user)
      {
        id: user.id,
        email: user.email,
        name: user.name,
        legal_name: user.legal_name,
        preferred_name: user.preferred_name,
      }
    end

    def success_response_with_jwt(user, status = :ok)
      jwt_token = generate_jwt_token(user)
      render json: { jwt: jwt_token, user: user_data(user) }, status: status
    end
end
