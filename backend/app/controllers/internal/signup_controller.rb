# frozen_string_literal: true

class Internal::SignupController < Internal::BaseController
  include LoginValidation, UserDataSerialization, JwtAuthenticatable

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
    password = params[:password]

    return unless validate_login_params(email, otp_code, password)
    if password.present? && password.length < 6
      render json: { error: "Password must be at least 6 characters long" }, status: :bad_request
      return false
    end

    if otp_code.present?
      temp_user = find_temp_user(email)
      return unless temp_user

      return unless check_otp_rate_limit(temp_user)
      return unless verify_user_otp(temp_user, otp_code)
    else
      temp_user = User.new(email: email, password: password)
      temp_user.save!(validate: false) # Skip validations for temp user
    end

    # Check again if user was created in the meantime
    existing_user = User.find_by(email: email)
    if existing_user && existing_user.id != temp_user.id
      temp_user.destroy
      return render json: { error: "An account with this email already exists. Please log in instead." }, status: :conflict
    end

    # Complete user creation
    result = complete_user_signup(temp_user)

    if result[:success]
      success_response_with_jwt(result[:user], :created)
    else
      render json: { error: result[:error_message] }, status: :unprocessable_entity
    end
  end

  private
    def find_temp_user(email)
      temp_user = User.find_by(email: email)
      unless temp_user
        render json: { error: "Invalid signup session" }, status: :not_found
        return nil
      end

      temp_user
    end

    def complete_user_signup(temp_user)
      ApplicationRecord.transaction do
        temp_user.update!(
          confirmed_at: Time.current,
          invitation_accepted_at: Time.current
        )
        temp_user.tos_agreements.create!(ip_address: request.remote_ip)

        { success: true, user: temp_user }
      end
    rescue ActiveRecord::RecordInvalid => e
      { success: false, error_message: e.record.errors.full_messages.to_sentence }
    end
end
