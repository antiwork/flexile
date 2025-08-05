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
      # Try to find user by email first
      user = User.find_by(email: email)

      if user
        # User exists, update Google ID if not set
        user.update!(google_uid: google_id) if user.google_uid.blank?
        user
      else
        # Create new user
        User.create!(
          email: email,
          name: name || email.split("@").first,
          google_uid: google_id,
          avatar_url: image,
          email_verified_at: Time.current
        )
      end
    end
end
