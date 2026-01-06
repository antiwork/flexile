# frozen_string_literal: true

class Internal::OauthController < Internal::BaseController
  include UserDataSerialization, JwtAuthenticatable

  skip_before_action :verify_authenticity_token

  def create
    email = params[:email].to_s.strip.downcase

    if email.blank?
      render json: { error: "Email is required" }, status: :bad_request
      return
    end

    user = User.find_by(email: email)
    if user
      user.update!(current_sign_in_at: Time.current)
      if params[:provider] == "github"
        user.update!(github_external_id: params[:provider_id], github_username: params[:github_username])
      end
      return success_response_with_jwt(user)
    end

    user_attributes = { email: email, confirmed_at: Time.current }
    if params[:provider] == "github"
      user_attributes[:github_external_id] = params[:provider_id]
      user_attributes[:github_username] = params[:github_username]
    end

    result = SignUpUser.new(user_attributes: user_attributes, ip_address: request.remote_ip).perform

    if result[:success]
      success_response_with_jwt(result[:user], :created)
    else
      render json: { error: result[:error_message] }, status: :unprocessable_entity
    end
  end
end
