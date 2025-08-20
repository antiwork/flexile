# frozen_string_literal: true

module LoginValidation
  extend ActiveSupport::Concern

  private
    def validate_login_params(email, otp_code, password)
      if email.blank?
        render json: { error: "Email is required" }, status: :bad_request
        return false
      end

      if otp_code.blank? && password.blank?
        render json: { error: "OTP code or password is required" }, status: :bad_request
        return false
      end

      if otp_code.present? && password.present?
        render json: { error: "Only one of OTP code or password is allowed" }, status: :bad_request
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

    def verify_user_password(user, password)
      # These return the same error message because we don't want to leak information about the user's account.
      unless user.encrypted_password.present? && user.valid_password?(password)
        render json: { error: "Password is incorrect or has not been set up. If you don\'t know your password, log in with email to receive an OTP instead." }, status: :unauthorized
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
