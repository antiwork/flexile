# frozen_string_literal: true

module Admin
  class ImpersonationsController < Admin::ApplicationController
    skip_before_action :authenticate_user
    skip_before_action :authenticate_admin
    before_action :require_team_member

    def create
      target_user = if params[:user_id].present?
        User.find_by(id: params[:user_id])
      elsif params[:email].present?
        User.find_by(email: params[:email])
      end

      unless target_user
        return render json: { error: "User not found" }, status: :not_found
      end

      if target_user.team_member?
        return render json: { error: "Cannot impersonate an admin" }, status: :forbidden
      end

      expires_at = 5.minutes.from_now
      token = target_user.signed_id(expires_in: 5.minutes, purpose: :impersonate)
      render json: { token: token, target_user_id: target_user.id, expires_at: expires_at.iso8601 }
    end

    def exchange
      user = User.find_signed(params[:token], purpose: :impersonate)
      unless user
        return render json: { error: "Invalid or expired token" }, status: :unprocessable_entity
      end

      if user.team_member?
        return render json: { error: "Cannot impersonate an admin" }, status: :forbidden
      end

      jwt = JwtService.generate_token(user)
      expires_at = 1.month.from_now
      render json: { jwt: jwt, user_id: user.id, impersonator_id: Current.user.id, expires_at: expires_at.iso8601 }
    end

    def destroy
      admin = Current.user
      unless admin&.team_member?
        return render json: { error: "Unauthorized" }, status: :unauthorized
      end

      jwt = JwtService.generate_token(admin)
      render json: { jwt: jwt, user_id: admin.id }
    end

    private
      def require_team_member
        return if Current.user&.team_member?
        render json: { error: "Unauthorized" }, status: :unauthorized
      end
  end
end

