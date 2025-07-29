# frozen_string_literal: true

module User::OtpAuthentication
  extend ActiveSupport::Concern

  included do
    before_create :generate_otp_secret_key
    has_one_time_password
  end

  MAX_OTP_ATTEMPTS = 5
  OTP_ATTEMPT_WINDOW = 10.minutes
  OTP_DRIFT = 10.minutes

  def verify_otp(code)
    return false if otp_rate_limited?

    is_valid = otp_code_valid?(code)

    if is_valid
      # Reset failure tracking on successful verification
      reset_otp_failure_tracking!
    else
      # Record the failed attempt
      record_otp_failure!
    end

    is_valid
  end

  def otp_rate_limited?
    return false unless otp_first_failed_at.present?

    # Check if we're still within the rate limit window
    time_since_first_failure = Time.current - otp_first_failed_at

    if time_since_first_failure > OTP_ATTEMPT_WINDOW
      # Window has passed, reset tracking
      reset_otp_failure_tracking!
      return false
    end

    # We're within the window, check if we've exceeded the limit
    otp_failed_attempts_count >= MAX_OTP_ATTEMPTS
  end

  private
    def generate_otp_secret_key
      self.otp_secret_key = User.otp_random_secret if otp_secret_key.blank?
    end

    def otp_code_valid?(code)
      return false if code.blank? || otp_secret_key.blank?

      # Accept test OTP code during local development and tests
      if !Rails.env.production? && ENV["ENABLE_DEFAULT_OTP"] == "true" && code.to_s == "000000"
        return true
      end

      self.authenticate_otp(code.to_s, drift: OTP_DRIFT)
    end

    def record_otp_failure!
      if otp_first_failed_at.blank?
        # First failure in this window
        update!(
          otp_first_failed_at: Time.current,
          otp_failed_attempts_count: 1
        )
      else
        # Additional failure in the same window
        increment!(:otp_failed_attempts_count)
      end
    end

    def reset_otp_failure_tracking!
      update!(
        otp_first_failed_at: nil,
        otp_failed_attempts_count: 0
      ) if otp_first_failed_at.present? || otp_failed_attempts_count > 0
    end
end
