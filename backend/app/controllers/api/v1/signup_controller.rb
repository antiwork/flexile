# frozen_string_literal: true

class Api::V1::SignupController < Api::BaseController
  include OtpValidation, UserDataSerialization

  skip_before_action :authenticate_with_jwt

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
    temp_user.save!(validate: false) # Skip validations for temp user

    return unless check_otp_rate_limit(temp_user)

    UserMailer.otp_code(temp_user.id).deliver_later

    render json: { message: "OTP sent successfully", temp_user_id: temp_user.id }, status: :ok
  end

  def verify_and_create
    email = params[:email]
    otp_code = params[:otp_code]
    temp_user_id = params[:temp_user_id]

    return unless validate_signup_params(email, otp_code, temp_user_id)

    temp_user = find_temp_user(temp_user_id, email)
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
      created_response_with_jwt(result[:user])
    else
      render json: { error: result[:error_message] }, status: :unprocessable_entity
    end
  end

  private
    def validate_signup_params(email, otp_code, temp_user_id)
      if email.blank? || otp_code.blank? || temp_user_id.blank?
        render json: { error: "Email, OTP code, and temp user ID are required" }, status: :bad_request
        return false
      end

      true
    end

    def find_temp_user(temp_user_id, email)
      temp_user = User.find_by(id: temp_user_id, email: email)
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

        # Handle invite links if present
        if cookies["invitation_token"].present?
          invite_link = CompanyInviteLink.find_by(token: cookies["invitation_token"])
          if invite_link
            temp_user.update!(signup_invite_link: invite_link)
            cookies.delete("invitation_token")
          end
        end

        # Create default company if no invite link
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
