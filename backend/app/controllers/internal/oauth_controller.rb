# frozen_string_literal: true

class Internal::OauthController < Internal::BaseController
  include UserDataSerialization, JwtAuthenticatable, ApiTokenAuthenticatable

  skip_before_action :verify_authenticity_token

  def create
    email = params[:email].to_s.strip.downcase

    if email.blank?
      render json: { error: "Email is required" }, status: :bad_request
      return
    end

    provider = params[:provider].to_s.downcase
    user = nil

    if provider == "github"
      github_uid = params[:github_uid]
      user = User.find_by(github_uid: github_uid) if github_uid.present?

      if user.blank?
        user = User.find_by(email: email)
        if user.present?
          user.update!(
            github_uid: github_uid,
            github_username: params[:github_username]
          )
        end
      end

      unless user
        render json: { error: "Account not found. Please sign up with email first or ensure your GitHub email matches your account." }, status: :not_found
        return
      end

      user.update!(github_username: params[:github_username]) if params[:github_username].present?
    else
      user = User.find_by(email: email)
      unless user
        result = SignUpUser.new(user_attributes: { email: email, confirmed_at: Time.current }, ip_address: request.remote_ip).perform
        if result[:success]
          user = result[:user]
        else
          render json: { error: result[:error_message] }, status: :unprocessable_entity
          return
        end
      end
    end

    user.update!(current_sign_in_at: Time.current)
    success_response_with_jwt(user, :ok)
  end
end
