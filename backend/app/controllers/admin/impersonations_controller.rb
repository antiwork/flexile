# frozen_string_literal: true

module Admin
  class ImpersonationsController < Admin::ApplicationController
    before_action :require_team_member

    def create
      user = User.find_signed(params[:token], purpose: :impersonate)
      if user
        session[:impersonator_id] = Current.user.id
        session[:user_id] = user.id
        token = JwtService.generate_token(user)
        cookies["x-flexile-auth"] = {
          value: "Bearer #{token}",
          secure: true,
          same_site: :strict,
          httponly: true,
          domain: DOMAIN,
        }
        redirect_to admin_root_path, notice: "Now impersonating #{user.email}"
      else
        redirect_to admin_root_path, alert: "Invalid or expired impersonation link."
      end
    end

    def destroy
      impersonator = User.find_by(id: session[:impersonator_id])
      if impersonator
        session[:user_id] = impersonator.id
        session.delete(:impersonator_id)
        token = JwtService.generate_token(impersonator)
        cookies["x-flexile-auth"] = {
          value: "Bearer #{token}",
          secure: true,
          same_site: :strict,
          httponly: true,
          domain: DOMAIN,
        }

        redirect_to admin_root_path, notice: "Stopped impersonating."
      else
        redirect_to admin_root_path, alert: "Not impersonating anyone."
      end
    end

    private
      def require_team_member
        return if Current.user&.team_member?
        redirect_to root_path, alert: "You are not authorized to perform this action."
      end
  end
end
