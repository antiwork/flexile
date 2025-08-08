# frozen_string_literal: true

class Internal::SignupController < Internal::BaseController
  include OtpValidation, UserDataSerialization, JwtAuthenticatable

  def send_otp
    email = params[:email]
    invitation_token = params[:invitation_token]

    return unless validate_email_param(email)

    # Check if user already exists
    existing_user = User.find_by(email: email)
    if existing_user
      return render json: { error: "An account with this email already exists. Please log in instead." }, status: :conflict
    end

    # Create a temporary user record for OTP verification
    temp_user = User.new(email: email)

    # Handle invite link if invitation_token is provided
    if invitation_token.present?
      invite_link = CompanyInviteLink.find_by(token: invitation_token)
      if invite_link
        temp_user.signup_invite_link = invite_link
      end
    end

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

    # Complete user creation
    result = complete_user_signup(temp_user)

    if result[:success]
      success_response_with_jwt(result[:user], :created)
    else
      render json: { error: result[:error_message] }, status: :unprocessable_entity
    end
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

    def complete_user_signup(temp_user)
      ApplicationRecord.transaction do
        # Complete the user setup
        temp_user.update!(
          confirmed_at: Time.current,
          invitation_accepted_at: Time.current
        )
        temp_user.tos_agreements.create!(ip_address: request.remote_ip)

        # Create default company if no invite link was set during send_otp
        unless temp_user.signup_invite_link
          company = Company.create!(
            email: temp_user.email,
            country_code: "US",
            default_currency: "USD"
          )
          temp_user.company_administrators.create!(company: company)
        end

        { success: true, user: temp_user }
      end
    rescue ActiveRecord::RecordInvalid => e
      { success: false, error_message: e.record.errors.full_messages.to_sentence }
    end
end
