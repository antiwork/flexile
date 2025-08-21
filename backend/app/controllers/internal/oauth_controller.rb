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
      return success_response_with_jwt(user)
    end

    result = SignUpUser.new(user_attributes: { email: email, confirmed_at: Time.current }, ip_address: request.remote_ip).perform

    if result[:success]
      success_response_with_jwt(result[:user], :created)
    else
      render json: { error: result[:error_message] }, status: :unprocessable_entity
    end
  end
end
