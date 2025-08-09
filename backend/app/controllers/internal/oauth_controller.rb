# frozen_string_literal: true

class Internal::OauthController < Api::BaseController
  include UserDataSerialization

  skip_before_action :authenticate_with_jwt

  def google_login
    email = params[:email]
    google_id = params[:google_id]

    return render json: { error: "Email is required" }, status: :bad_request if email.blank?
    return render json: { error: "Google ID is required" }, status: :bad_request if google_id.blank?

    user = handle_google_login(email, google_id)
    return unless user

    user.update!(current_sign_in_at: Time.current)
    success_response_with_jwt(user)
  end

  def google_signup
    email = params[:email]
    google_id = params[:google_id]
    invitation_token = params[:invitation_token]

    return render json: { error: "Email is required" }, status: :bad_request if email.blank?
    return render json: { error: "Google ID is required" }, status: :bad_request if google_id.blank?

    user = handle_google_signup(email, google_id, invitation_token)
    return unless user

    user.update!(current_sign_in_at: Time.current)
    success_response_with_jwt(user)
  end

  private
    def handle_google_login(email, google_id)
      user = User.find_by(email: email)
      unless user
        render json: { error: "User not found" }, status: :not_found
        return nil
      end

      user.update!(google_uid: google_id) if user.google_uid.blank?
      user
    end

    def handle_google_signup(email, google_id, invitation_token)
      existing_user = User.find_by(email: email)
      if existing_user
        render json: { error: "An account with this email already exists. Please log in instead." }, status: :conflict
        return nil
      end

      complete_google_user_signup(email, google_id, invitation_token)
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
