# frozen_string_literal: true

class Api::V1::EmailOtpController < Api::BaseController
  include OtpValidation

  skip_before_action :authenticate_with_jwt

  def create
    email = params[:email]

    return unless validate_email_param(email)

    user = find_user_by_email(email)
    return unless user

    return unless check_otp_rate_limit(user)

    UserMailer.otp_code(user.id).deliver_later

    render json: { message: "OTP sent successfully" }, status: :ok
  end
end
