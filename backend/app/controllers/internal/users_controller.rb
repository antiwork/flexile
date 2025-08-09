# frozen_string_literal: true

class Internal::UsersController < Internal::BaseController
  include UserDataSerialization, JwtAuthenticatable, OtpValidation

  def find_by_email
    email = params[:email]

    if email.blank?
      render json: { error: "Email is required" }, status: :bad_request
      return
    end

    user = find_user_by_email(email)

    # find_user_by_email already handles the case when user is nil
    # by rendering an error response, so we just need to return if user is nil
    return if user.nil?

    success_response_with_jwt(user)
  end
end
