# frozen_string_literal: true

module OtpValidation
  extend ActiveSupport::Concern

  private
    def validate_otp_params(email, otp_code)
      if email.blank?
        render json: { error: "Email is required" }, status: :bad_request
        return false
      end

      if otp_code.blank?
        render json: { error: "OTP code is required" }, status: :bad_request
        return false
      end

      true
    end

    def find_user_by_email(email)
      user = User.find_by(email: email)
      unless user
        render json: { error: "User not found" }, status: :not_found
        return nil
      end

      user
    end

    def check_otp_rate_limit(user)
      if user.otp_rate_limited?
        render json: {
          error: "Too many login attempts. Please wait before trying again.",
          retry_after: 10.minutes.to_i,
        }, status: :too_many_requests
        return false
      end

      true
    end

    def verify_user_otp(user, otp_code)
      unless user.verify_otp(otp_code)
        render json: { error: "Invalid verification code, please try again." }, status: :unauthorized
        return false
      end

      true
    end

    def validate_email_param(email)
      if email.blank?
        render json: { error: "Email is required" }, status: :bad_request
        return false
      end

      true
    end
end
