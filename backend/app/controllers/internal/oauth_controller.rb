# frozen_string_literal: true

class Internal::OauthController < Internal::BaseController
  include UserDataSerialization, JwtAuthenticatable, UserSignupCompletion

  skip_before_action :verify_authenticity_token

  def create
    email = params[:email]
    return unless validate_params(email)

    user = User.find_or_initialize_by(email: email)
    if user.persisted?
      user.update!(current_sign_in_at: Time.current)
      success_response_with_jwt(user)
      return
    end

    user = complete_user_signup(user)
    success_response_with_jwt(user, :created)
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  private
    def validate_params(email)
      if email.blank?
        render json: { error: "Email is required" }, status: :bad_request
        return false
      end

      true
    end
end
