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

    user = nil
    if github_params_present?
      user = User.find_by(github_uid: params[:github_uid])
    end

    user ||= User.find_by(email: email)

    if user
      user.update!(current_sign_in_at: Time.current)
      update_github_info(user) if github_params_present?
      return success_response_with_jwt(user)
    end

    user_attributes = { email: email, confirmed_at: Time.current }
    user_attributes.merge!(github_attributes) if github_params_present?

    result = SignUpUser.new(user_attributes: user_attributes, ip_address: request.remote_ip).perform

    if result[:success]
      success_response_with_jwt(result[:user], :created)
    else
      render json: { error: result[:error_message] }, status: :unprocessable_entity
    end
  end

  private
    def github_params_present?
      params[:github_uid].present? && params[:github_username].present?
    end

    def github_attributes
      {
        github_uid: params[:github_uid],
        github_username: params[:github_username],
        github_access_token: params[:github_access_token],
      }
    end

    def update_github_info(user)
      # Only update if user doesn't have GitHub connected, or if the same GitHub account
      return if user.github_uid.present? && user.github_uid != params[:github_uid]

      user.update!(github_attributes)
    end
end
