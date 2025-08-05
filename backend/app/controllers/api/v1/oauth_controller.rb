# frozen_string_literal: true

class Api::V1::OauthController < Api::BaseController
  include UserDataSerialization

  skip_before_action :authenticate_with_jwt

  def google
    email = params[:email]
    name = params[:name]
    google_id = params[:google_id]
    image = params[:image]

    return render json: { error: "Email is required" }, status: :bad_request if email.blank?
    return render json: { error: "Google ID is required" }, status: :bad_request if google_id.blank?

    begin
      user = find_or_create_google_user(email, name, google_id, image)
      user.update!(current_sign_in_at: Time.current)

      success_response_with_jwt(user)
    rescue StandardError => e
      Rails.logger.error "Google OAuth error: #{e.message}"
      render json: { error: "Authentication failed" }, status: :internal_server_error
    end
  end

  private
    def find_or_create_google_user(email, name, google_id, image)
      user = User.find_by(email: email)

      if user
        user.update!(google_uid: google_id) if user.google_uid.blank?
        user
      else
        complete_google_user_signup(email, name, google_id, image)
      end
    end

    def complete_google_user_signup(email, name, google_id, image)
      ApplicationRecord.transaction do
        # Create user with all required fields (matching signup controller)
        user = User.create!(
          email: email,
          name: name || email.split("@").first,
          google_uid: google_id,
          avatar_url: image,
          email_verified_at: Time.current,
          confirmed_at: Time.current,
          invitation_accepted_at: Time.current
        )

        # Create TOS agreement (required for legal compliance)
        user.tos_agreements.create!(ip_address: request.remote_ip)

        # Create default company for the user (matching signup controller logic)
        company = Company.create!(
          email: user.email,
          country_code: "US",
          default_currency: "USD"
        )

        # Make user an administrator of their company
        user.company_administrators.create!(company: company)

        user
      end
    end
end
