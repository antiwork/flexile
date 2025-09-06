# frozen_string_literal: true

class Internal::Admin::ImpersonationController < ApplicationController
  skip_before_action :verify_authenticity_token
  before_action :authenticate_user_json!
  before_action :ensure_admin_user

  def create
    user = User.find_by(email: params[:email])

    if user.nil?
      render json: { success: false, error: "User not found" }, status: :not_found
      return
    end

    if user.team_member?
      render json: { success: false, error: "Cannot impersonate admin users" }, status: :forbidden
      return
    end

    impersonation_jwt = JwtService.generate_token(user)

    render json: {
      success: true,
      impersonation_jwt: impersonation_jwt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        legal_name: user.legal_name,
        preferred_name: user.preferred_name,
      },
    }
  end

  private
    def ensure_admin_user
      unless Current.user.team_member?
        render json: { success: false, error: "Admin access required" }, status: :forbidden
      end
    end
end
