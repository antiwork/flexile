# frozen_string_literal: true

class Api::V1::LoginController < Api::BaseController
  include OtpValidation, UserDataSerialization

  skip_before_action :authenticate_with_jwt

  def create
    email = params[:email]
    otp_code = params[:otp_code]

    return unless validate_otp_params(email, otp_code)

    user = find_user_by_email(email)
    return unless user

    return unless check_otp_rate_limit(user)
    return unless verify_user_otp(user, otp_code)

    user.update!(current_sign_in_at: Time.current)

    success_response_with_jwt(user)
  end
end
