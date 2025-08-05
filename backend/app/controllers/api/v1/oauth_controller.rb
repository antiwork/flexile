# frozen_string_literal: true

class Api::V1::OauthController < Api::BaseController
  include UserDataSerialization

  skip_before_action :authenticate_with_jwt

  def google
    email = params[:email]
    google_id = params[:google_id]
    invitation_token = params[:invitation_token]

    return render json: { error: "Email is required" }, status: :bad_request if email.blank?
    return render json: { error: "Google ID is required" }, status: :bad_request if google_id.blank?

    begin
      user = find_or_create_google_user(email, google_id, invitation_token)
      user.update!(current_sign_in_at: Time.current)

      success_response_with_jwt(user)
    rescue StandardError => e
      Rails.logger.error "Google OAuth error: #{e.message}"
      render json: { error: "Authentication failed" }, status: :internal_server_error
    end
  end

  private
    def find_or_create_google_user(email, google_id, invitation_token)
      user = User.find_by(email: email)

      if user
        user.update!(google_uid: google_id) if user.google_uid.blank?
        user
      else
        complete_google_user_signup(email, google_id, invitation_token)
      end
    end

    def complete_google_user_signup(email, google_id, invitation_token)
      ApplicationRecord.transaction do
        invite_link = nil
        if invitation_token.present?
          invite_link = CompanyInviteLink.find_by(token: invitation_token)
        end

        user = User.create!(
          email: email,
          google_uid: google_id,
          confirmed_at: Time.current,
          invitation_accepted_at: Time.current,
          signup_invite_link: invite_link
        )

        user.tos_agreements.create!(ip_address: request.remote_ip)

        unless user.signup_invite_link
          company = Company.create!(
            email: user.email,
            country_code: "US",
            default_currency: "USD"
          )
          user.company_administrators.create!(company: company)
        end

        user
      end
    end
end
