# frozen_string_literal: true

class Internal::OauthController < Internal::BaseController
  include UserDataSerialization, JwtAuthenticatable

  skip_before_action :authenticate_with_jwt

  def oauth_login
    email = params[:email]

    return render json: { error: "Email is required" }, status: :bad_request if email.blank?

    user = handle_oauth_login(email)
    return unless user

    user.update!(current_sign_in_at: Time.current)
    success_response_with_jwt(user)
  end

  def oauth_signup
    email = params[:email]

    return render json: { error: "Email is required" }, status: :bad_request if email.blank?

    user = handle_oauth_signup(email)
    return unless user

    user.update!(current_sign_in_at: Time.current)
    success_response_with_jwt(user)
  end

  private
    def handle_oauth_login(email)
      user = User.find_by(email: email)
      unless user
        render json: { error: "User not found" }, status: :not_found
        return nil
      end

      user
    end

    def handle_oauth_signup(email)
      existing_user = User.find_by(email: email)
      if existing_user
        render json: { error: "An account with this email already exists. Please log in instead." }, status: :conflict
        return nil
      end

      complete_oauth_user_signup(email)
    end

    def complete_oauth_user_signup(email)
      ApplicationRecord.transaction do
        user = User.create!(
          email: email,
          confirmed_at: Time.current,
          invitation_accepted_at: Time.current
        )

        CompleteUserSetup.new(user: user, ip_address: request.remote_ip).perform

        user
      end
    end
end
