# frozen_string_literal: true

class Api::V1::EmailOtpController < Api::BaseController
  skip_before_action :authenticate_with_jwt

  def create
    email = params[:email]

    if email.blank?
      return render json: { error: "Email is required" }, status: :bad_request
    end

    user = User.find_by(email: email)
    unless user
      return render json: { error: "User not found" }, status: :not_found
    end

    if user.otp_rate_limited?
      return render json: {
        error: "Too many OTP attempts. Please wait before trying again.",
        retry_after: 10.minutes.to_i,
      }, status: :too_many_requests
    end

    UserMailer.otp_code(user.id).deliver_later

    render json: { message: "OTP sent successfully" }, status: :ok
  end
end
