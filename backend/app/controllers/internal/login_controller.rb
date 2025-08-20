# frozen_string_literal: true

class Internal::LoginController < Internal::BaseController
  include LoginValidation, UserDataSerialization, JwtAuthenticatable

  def create
    email = params[:email]
    otp_code = params[:otp_code]
    password = params[:password]

    return unless validate_login_params(email, otp_code, password)

    user = find_user_by_email(email)
    return unless user

    if otp_code.present?
      return unless check_otp_rate_limit(user)
      return unless verify_user_otp(user, otp_code)
    else
      return unless verify_user_password(user, password)
    end

    user.update!(current_sign_in_at: Time.current)

    success_response_with_jwt(user)
  end
end
