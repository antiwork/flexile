# frozen_string_literal: true

module Admin
  class ImpersonationsController < Admin::ApplicationController
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

      jwt = JwtService.generate_token(target_user)
      expires_at = 1.month.from_now
      render json: { jwt: jwt, user_id: target_user.id, impersonator_id: Current.user.id, expires_at: expires_at.iso8601 }
    end
  end
end
