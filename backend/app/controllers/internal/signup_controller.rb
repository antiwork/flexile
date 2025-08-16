# frozen_string_literal: true

class Internal::SignupController < Internal::BaseController
  include OtpValidation, UserDataSerialization, JwtAuthenticatable, UserSignupCompletion

  def send_otp
    email = params[:email]

    return unless validate_email_param(email)

    # Check if user already exists
    existing_user = User.find_by(email: email)
    if existing_user
      return render json: { error: "An account with this email already exists. Please log in instead." }, status: :conflict
    end

    # Create a temporary user record for OTP verification
    temp_user = User.new(email: email)

    # TODO: Run basic validation when creating temp user
    temp_user.save!(validate: false) # Skip validations for temp user

    return unless check_otp_rate_limit(temp_user)

    UserMailer.otp_code(temp_user.id).deliver_later

    render json: { message: "OTP sent successfully" }, status: :ok
  end

  def verify_and_create
    email = params[:email]
    otp_code = params[:otp_code]

    return unless validate_signup_params(email, otp_code)

    temp_user = find_temp_user(email)
    return unless temp_user

    return unless check_otp_rate_limit(temp_user)
    return unless verify_user_otp(temp_user, otp_code)

    # Check again if user was created in the meantime
    existing_user = User.find_by(email: email)
    if existing_user && existing_user.id != temp_user.id
      temp_user.destroy
      return render json: { error: "An account with this email already exists. Please log in instead." }, status: :conflict
    end

    user = complete_user_signup(temp_user)
    success_response_with_jwt(user, :created)
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  private
    def validate_signup_params(email, otp_code)
      if email.blank? || otp_code.blank?
        render json: { error: "Email and OTP code are required" }, status: :bad_request
        return false
      end

      true
    end

    def find_temp_user(email)
      temp_user = User.find_by(email: email)
      unless temp_user
        render json: { error: "Invalid signup session" }, status: :not_found
        return nil
      end

      temp_user
    end
end
